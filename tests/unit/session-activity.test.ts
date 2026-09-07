import { describe, expect, it } from "vitest";
import { buildSessionActivity } from "@/modules/sessions/lib/session-activity";
import type { Expense, Order, OrderPayment, SupplierPayment } from "@/lib/types";

describe("buildSessionActivity", () => {
  it("combines sales, discounts, expenses, supplier payments, and lifecycle chronologically", () => {
    const events = buildSessionActivity({
      session: {
        id: "session-1",
        opened_at: "2026-09-07T08:00:00.000Z",
        closed_at: "2026-09-07T12:00:00.000Z",
        opening_cash: 100,
        actual_cash: 150,
        cashier_id: "user-1",
        closed_by: "user-2",
      },
      orders: [{
        id: "order-1",
        order_number: "ORD-1",
        status: "completed",
        total: 84,
        discount: 10,
        promo_discount: 4,
        created_at: "2026-09-07T09:00:00.000Z",
        created_by: "user-1",
      } as Order],
      orderPayments: [{ order_id: "order-1", method: "cash", amount: 84 } as OrderPayment],
      expenses: [{
        id: "expense-1",
        title: "نظافة",
        amount: 20,
        payment_method: "cash",
        status: "approved",
        notes: "",
        created_at: "2026-09-07T10:00:00.000Z",
        created_by: "user-1",
      } as Expense],
      supplierPayments: [{
        id: "supplier-payment-1",
        supplier_id: "supplier-1",
        amount: 30,
        payment_method: "cash",
        paid_at: "2026-09-07T11:00:00.000Z",
        created_by: "user-1",
        reference: "REF-1",
        notes: "",
        voided_at: null,
      } as SupplierPayment],
      userNames: new Map([["user-1", "أحمد"], ["user-2", "المدير"]]),
      supplierNames: new Map([["supplier-1", "المورد الأول"]]),
    });

    expect(events.map((event) => event.kind)).toEqual([
      "session_closed",
      "supplier_payment",
      "expense",
      "sale",
      "session_opened",
    ]);
    const sale = events.find((event) => event.kind === "sale");
    expect(sale?.discount).toBe(10);
    expect(sale?.description).toContain("خصم يدوي 6");
    expect(sale?.description).toContain("عرض تلقائي 4");
    expect(events.find((event) => event.kind === "supplier_payment")?.title).toContain("المورد الأول");
  });
});
