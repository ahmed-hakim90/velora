import * as customerRepo from "@/lib/repositories/customer.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as reportRepo from "@/lib/repositories/report.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import type { CashierSession, Order } from "@/lib/types";
import { getSessionById } from "@/modules/sessions/services/session.service";
import { loadSessionCashBundle } from "@/modules/sessions/services/reconciliation.service";
import {
  buildSessionActivity,
  type SessionActivityEvent,
} from "@/modules/sessions/lib/session-activity";

export interface SessionInvoiceRow extends Order {
  customerName: string | null;
  hasCustomer: boolean;
}

export interface SessionDetail {
  session: CashierSession;
  storeName: string;
  cashierName: string;
  closedByName: string | null;
  invoices: SessionInvoiceRow[];
  orderCount: number;
  totalSales: number;
  invoicesWithCustomer: number;
  reconciliation: Awaited<ReturnType<typeof reportRepo.getSessionReconciliationRpc>> | null;
  activity: SessionActivityEvent[];
}

export async function getSessionDetail(
  sessionId: string,
  options?: { storeId?: string | null; canViewAll?: boolean }
): Promise<SessionDetail | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;

  if (!options?.canViewAll && options?.storeId && session.store_id !== options.storeId) {
    return null;
  }

  // Defense-in-depth: canViewAll must still stay inside the caller's org.
  const store = await storeRepo.getStore(session.store_id);
  if (!store) return null;

  const [orders, users, reconciliation, cashBundle, suppliers] = await Promise.all([
    orderRepo.listOrdersBySessionIds([sessionId]),
    userRepo.listUsers(),
    reportRepo.getSessionReconciliationRpc(sessionId).catch(() => null),
    loadSessionCashBundle(sessionId),
    purchaseRepo.listSuppliers(),
  ]);

  const orderPayments = await orderRepo.getOrderPaymentsForOrders(
    orders.map((order) => order.id)
  );

  const customerIds = orders
    .map((order) => order.customer_id)
    .filter((id): id is string => Boolean(id));
  const customers = await customerRepo.getCustomersByIds(customerIds);
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

  const invoices: SessionInvoiceRow[] = orders.map((order) => ({
    ...order,
    hasCustomer: Boolean(order.customer_id),
    customerName: order.customer_id
      ? (customerMap.get(order.customer_id) ?? null)
      : null,
  }));

  const completed = invoices.filter((order) => order.status === "completed");

  return {
    session,
    storeName: store.name,
    cashierName: userMap.get(session.cashier_id) ?? "الكاشير",
    closedByName: session.closed_by
      ? (userMap.get(session.closed_by) ?? null)
      : null,
    invoices,
    orderCount: completed.length,
    totalSales: completed.reduce((sum, order) => sum + order.total, 0),
    invoicesWithCustomer: invoices.filter((order) => order.hasCustomer).length,
    reconciliation,
    activity: buildSessionActivity({
      session,
      orders,
      orderPayments,
      expenses: cashBundle.expenses,
      supplierPayments: cashBundle.supplierPayments,
      userNames: userMap,
      supplierNames: supplierMap,
    }),
  };
}
