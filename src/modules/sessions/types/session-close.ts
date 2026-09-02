import type { CashierSession, Expense } from "@/lib/types";
import type { SessionReconciliation } from "@/modules/sessions/services/reconciliation.service";

export function getSessionReconciliationVersion(value: SessionReconciliation): string {
  return JSON.stringify([
    value.openingCash,
    value.cashSales,
    value.cashRefunds,
    value.expenses,
    value.supplierPayments,
    value.expectedCash,
    value.totalSales,
    value.orderCount,
  ]);
}

export type CloseSessionResult =
  | {
      status: "closed";
      session: CashierSession;
      expectedCash: number;
      actualCash: number;
      variance: number;
    }
  | {
      status: "reconciliation_changed";
      reconciliation: SessionReconciliation;
      expenses: Expense[];
    }
  | {
      status: "vault_pending";
      sessionId: string;
      expectedCash: number;
      actualCash: number;
      variance: number;
      message: string;
    };
