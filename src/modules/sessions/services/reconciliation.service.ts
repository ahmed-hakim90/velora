import { callRpc, throwDbError } from "@/lib/repositories/client";
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
  if (error) throwDbError(error, "pos_session_cash_bundle");
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
