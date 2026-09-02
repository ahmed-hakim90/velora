import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPosSessionOrderAction,
  listPosSessionOrdersAction,
} from "@/modules/pos/actions/session-orders.actions";
import * as posAccess from "@/lib/auth/pos-access";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as orderService from "@/modules/orders/services/order.service";

vi.mock("@/lib/auth/pos-access");
vi.mock("@/lib/repositories/order.repository");
vi.mock("@/lib/repositories/customer.repository");
vi.mock("@/modules/orders/services/order.service");

const context = {
  user: { role: "cashier" },
  storeId: "store-1",
  deviceId: "device-1",
  activeCashierId: "cashier-1",
};

const order = {
  id: "order-1",
  store_id: "store-1",
  session_id: "session-1",
  order_number: "SF-1",
  customer_id: null,
  status: "completed" as const,
  subtotal: 18,
  discount: 0,
  tax: 0,
  total: 18,
  payment_status: "paid" as const,
  created_by: "cashier-1",
  created_at: "2026-09-02T18:00:00.000Z",
};

describe("POS session invoice actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(posAccess.requirePosAccess).mockResolvedValue(context as never);
    vi.mocked(posAccess.getActiveSessionForPos).mockResolvedValue({
      id: "session-1",
    } as never);
    vi.mocked(customerRepo.getCustomersByIds).mockResolvedValue([]);
    vi.mocked(orderRepo.getOrderPaymentsForOrders).mockResolvedValue([]);
  });

  it("lists only orders requested for the active store and session", async () => {
    vi.mocked(orderRepo.listOrders).mockResolvedValue([order]);

    await expect(listPosSessionOrdersAction()).resolves.toEqual([
      {
        id: "order-1",
        orderNumber: "SF-1",
        createdAt: "2026-09-02T18:00:00.000Z",
        total: 18,
        status: "completed",
        paymentStatus: "paid",
        customerName: null,
        customerPhone: null,
        paymentMethods: [],
      },
    ]);
    expect(orderRepo.listOrders).toHaveBeenCalledWith({
      storeId: "store-1",
      sessionId: "session-1",
    });
  });

  it("adds customer and payment details without per-order lookups", async () => {
    vi.mocked(orderRepo.listOrders).mockResolvedValue([
      { ...order, customer_id: "customer-1" },
    ]);
    vi.mocked(customerRepo.getCustomersByIds).mockResolvedValue([
      { id: "customer-1", name: "Ahmed", phone: "01069005019" } as never,
    ]);
    vi.mocked(orderRepo.getOrderPaymentsForOrders).mockResolvedValue([
      {
        id: "payment-1",
        order_id: "order-1",
        method: "cash",
        amount: 10,
        reference: null,
      },
      {
        id: "payment-2",
        order_id: "order-1",
        method: "card",
        amount: 8,
        reference: null,
      },
    ]);

    const result = await listPosSessionOrdersAction();

    expect(customerRepo.getCustomersByIds).toHaveBeenCalledWith(["customer-1"]);
    expect(orderRepo.getOrderPaymentsForOrders).toHaveBeenCalledWith([
      "order-1",
    ]);
    expect(result[0]).toMatchObject({
      customerName: "Ahmed",
      customerPhone: "01069005019",
      paymentMethods: ["cash", "card"],
    });
  });

  it("rejects an invoice from another session", async () => {
    vi.mocked(orderService.getOrder).mockResolvedValue({
      ...order,
      session_id: "session-2",
    } as never);

    await expect(getPosSessionOrderAction("order-1")).rejects.toThrow(
      "الفاتورة غير موجودة في الجلسة الحالية",
    );
  });

  it("rejects an invoice from another store", async () => {
    vi.mocked(orderService.getOrder).mockResolvedValue({
      ...order,
      store_id: "store-2",
    } as never);

    await expect(getPosSessionOrderAction("order-1")).rejects.toThrow(
      "الفاتورة غير موجودة في الجلسة الحالية",
    );
  });

  it("requires an active session before listing invoices", async () => {
    vi.mocked(posAccess.getActiveSessionForPos).mockResolvedValue(null);

    await expect(listPosSessionOrdersAction()).rejects.toThrow(
      "لا توجد جلسة بيع نشطة",
    );
    expect(orderRepo.listOrders).not.toHaveBeenCalled();
  });

  it("returns full details for an invoice in the active session", async () => {
    const details = {
      ...order,
      items: [],
      payments: [],
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      customerAddress: null,
      customerTaxId: null,
      storeName: "Store",
    };
    vi.mocked(orderService.getOrder).mockResolvedValue(details as never);

    await expect(getPosSessionOrderAction("order-1")).resolves.toBe(details);
  });
});
