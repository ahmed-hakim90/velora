"use server";

import {
  getActiveSessionForPos,
  requirePosAccess,
} from "@/lib/auth/pos-access";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as customerRepo from "@/lib/repositories/customer.repository";
import type { PaymentMethod } from "@/lib/types";
import {
  getOrder,
  type OrderWithDetails,
} from "@/modules/orders/services/order.service";

export interface PosSessionOrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  total: number;
  status: OrderWithDetails["status"];
  paymentStatus: OrderWithDetails["payment_status"];
  customerName: string | null;
  customerPhone: string | null;
  paymentMethods: PaymentMethod[];
}

async function requireActivePosSession() {
  const ctx = await requirePosAccess({ touchSeen: false });
  const session = await getActiveSessionForPos(ctx);
  if (!session) throw new Error("لا توجد جلسة بيع نشطة");
  return { ctx, session };
}

export async function listPosSessionOrdersAction(): Promise<
  PosSessionOrderSummary[]
> {
  const { ctx, session } = await requireActivePosSession();
  const orders = await orderRepo.listOrders({
    storeId: ctx.storeId,
    sessionId: session.id,
  });
  const [customers, payments] = await Promise.all([
    customerRepo.getCustomersByIds(
      orders.flatMap((order) => (order.customer_id ? [order.customer_id] : [])),
    ),
    orderRepo.getOrderPaymentsForOrders(orders.map((order) => order.id)),
  ]);
  const customerById = new Map(
    customers.map((customer) => [customer.id, customer]),
  );
  const paymentMethodsByOrderId = new Map<string, PaymentMethod[]>();
  for (const payment of payments) {
    const methods = paymentMethodsByOrderId.get(payment.order_id) ?? [];
    if (!methods.includes(payment.method)) methods.push(payment.method);
    paymentMethodsByOrderId.set(payment.order_id, methods);
  }

  return orders.map((order) => {
    const customer = order.customer_id
      ? customerById.get(order.customer_id)
      : undefined;
    return {
      id: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      total: order.total,
      status: order.status,
      paymentStatus: order.payment_status,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
      paymentMethods: paymentMethodsByOrderId.get(order.id) ?? [],
    };
  });
}

export async function getPosSessionOrderAction(
  orderId: string,
): Promise<OrderWithDetails> {
  const { ctx, session } = await requireActivePosSession();
  const order = await getOrder(orderId);
  if (
    !order ||
    order.store_id !== ctx.storeId ||
    order.session_id !== session.id
  ) {
    throw new Error("الفاتورة غير موجودة في الجلسة الحالية");
  }
  return order;
}
