import { callRpc, throwDbError } from "@/lib/repositories/client";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as paymentRepo from "@/lib/repositories/supplier-payment.repository";
import { mapExpense, mapSupplierPayment } from "@/lib/repositories/mappers";
import type { Expense, SupplierPayment } from "@/lib/types";

export interface SessionReconciliation {
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  expenses: number;
  /** Non-voided cash supplier payments linked to this session. */
  supplierPayments: number;
  expectedCash: number;
  /** Completed order totals (all payment methods). */
  totalSales: number;
  orderCount: number;
}

export interface SessionCashBundle {
  reconciliation: SessionReconciliation;
  expenses: Expense[];
  supplierPayments: SupplierPayment[];
}

function emptyReconciliation(): SessionReconciliation {
  return {
    openingCash: 0,
    cashSales: 0,
    cashRefunds: 0,
    expenses: 0,
    supplierPayments: 0,
    expectedCash: 0,
    totalSales: 0,
    orderCount: 0,
  };
}

function isMissingBundleRpc(message: string): boolean {
  return (
    message.includes("pos_session_cash_bundle") &&
    (message.includes("schema cache") || message.includes("PGRST202"))
  );
}

async function loadSessionCashBundleFallback(
  sessionId: string,
): Promise<SessionCashBundle> {
  const session = await sessionRepo.getSession(sessionId);
  if (!session) {
    return {
      reconciliation: emptyReconciliation(),
      expenses: [],
      supplierPayments: [],
    };
  }

  const [orders, expenses, supplierPayments] = await Promise.all([
    orderRepo.listOrdersBySessionIds([sessionId]),
    expenseRepo.listExpenses({ storeId: session.store_id, sessionId }),
    paymentRepo.listPaymentsForSessions([sessionId]),
  ]);
  const relevantOrderIds = orders
    .filter((order) =>
      ["completed", "voided", "refunded"].includes(order.status),
    )
    .map((order) => order.id);
  const payments =
    await orderRepo.getOrderPaymentsForOrders(relevantOrderIds);
  const cashByOrder = new Map<string, number>();
  for (const payment of payments) {
    if (payment.method !== "cash") continue;
    cashByOrder.set(
      payment.order_id,
      (cashByOrder.get(payment.order_id) ?? 0) + payment.amount,
    );
  }

  let cashSales = 0;
  let cashRefunds = 0;
  let totalSales = 0;
  let orderCount = 0;
  for (const order of orders) {
    const cash = cashByOrder.get(order.id) ?? 0;
    if (order.status === "completed") {
      cashSales += cash;
      totalSales += order.total;
      orderCount += 1;
    } else if (order.status === "voided" || order.status === "refunded") {
      cashRefunds += cash;
    }
  }

  const expenseTotal = expenses
    .filter(
      (expense) =>
        expense.expense_source === "session_cash" &&
        expense.payment_method === "cash" &&
        expense.status === "approved",
    )
    .reduce((total, expense) => total + expense.amount, 0);
  const supplierPaymentTotal = supplierPayments
    .filter(
      (payment) => !payment.voided_at && payment.payment_method === "cash",
    )
    .reduce((total, payment) => total + payment.amount, 0);

  return {
    reconciliation: {
      openingCash: session.opening_cash,
      cashSales,
      cashRefunds,
      expenses: expenseTotal,
      supplierPayments: supplierPaymentTotal,
      expectedCash:
        session.opening_cash +
        cashSales -
        cashRefunds -
        expenseTotal -
        supplierPaymentTotal,
      totalSales,
      orderCount,
    },
    expenses,
    supplierPayments,
  };
}

/** One session-scoped load for close-shift UI + expected cash. */
export async function loadSessionCashBundle(sessionId: string): Promise<SessionCashBundle> {
  type RpcBundle = {
    reconciliation?: Partial<SessionReconciliation>;
    expenses?: Parameters<typeof mapExpense>[0][];
    supplierPayments?: Parameters<typeof mapSupplierPayment>[0][];
  };
  const { data, error } = await callRpc<RpcBundle>("pos_session_cash_bundle", {
    p_session_id: sessionId,
  });
  if (error) {
    if (isMissingBundleRpc(error.message)) {
      console.warn(
        "[sessions] pos_session_cash_bundle is unavailable; using compatible queries",
      );
      return loadSessionCashBundleFallback(sessionId);
    }
    throwDbError(error, "pos_session_cash_bundle");
  }
  if (!data) {
    return { reconciliation: emptyReconciliation(), expenses: [], supplierPayments: [] };
  }
  const raw = data.reconciliation ?? {};
  return {
    reconciliation: {
      openingCash: Number(raw.openingCash ?? 0),
      cashSales: Number(raw.cashSales ?? 0),
      cashRefunds: Number(raw.cashRefunds ?? 0),
      expenses: Number(raw.expenses ?? 0),
      supplierPayments: Number(raw.supplierPayments ?? 0),
      expectedCash: Number(raw.expectedCash ?? 0),
      totalSales: Number(raw.totalSales ?? 0),
      orderCount: Number(raw.orderCount ?? 0),
    },
    expenses: (data.expenses ?? []).map(mapExpense),
    supplierPayments: (data.supplierPayments ?? []).map(mapSupplierPayment),
  };
}

export async function calcExpectedCash(
  sessionId: string
): Promise<SessionReconciliation> {
  const { reconciliation } = await loadSessionCashBundle(sessionId);
  return reconciliation;
}

export function calcVariance(expected: number, actual: number) {
  return actual - expected;
}
