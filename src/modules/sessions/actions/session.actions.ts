"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requirePermissionOrRole, requireStoreAccess } from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { requirePosAccess, getPosAccessOrNull, PosAccessError } from "@/lib/auth/pos-access";
import {
  calcExpectedCash,
  loadSessionCashBundle,
} from "@/modules/sessions/services/reconciliation.service";
import {
  closeSession,
  forceCloseSession,
  openSession,
  getSessionById,
  SessionVaultDepositError,
} from "@/modules/sessions/services/session.service";
import {
  batchWithdrawStoreCashierVaults,
  getCashierVault,
  getPendingOpeningFloat,
  withdrawFromCashierVault,
} from "@/modules/sessions/services/cashier-vault.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";
import { roundMoney } from "@/lib/money";
import {
  getSessionReconciliationVersion,
  type CloseSessionResult,
} from "@/modules/sessions/types/session-close";

function validCashAmount(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("المبلغ الفعلي لازم يكون رقم صحيح وصفر أو أكبر");
  }
  return roundMoney(value);
}

function mapPosAccessError(error: PosAccessError): string {
  const messages: Record<PosAccessError["code"], string> = {
    login_required: "افتح رابط الفرع واكتب PIN الكاشير أولاً",
    no_device: "افتح رابط الفرع زي /nutalla/pos ثم أعد المحاولة",
    device_inactive: "افتح رابط الفرع من جديد لتجهيز نقطة البيع",
    store_mismatch: "افتح رابط الفرع الصحيح قبل فتح الجلسة",
    store_required: "اختر الفرع أولاً قبل فتح الجلسة",
    access_denied: "ليس لديك صلاحية على هذا الفرع",
    cashier_required: "أدخل رقم PIN للكاشير أولاً",
    role_denied: "دورك لا يسمح بفتح جلسة كاشير",
  };
  return messages[error.code] ?? error.message;
}

/**
 * Resolve opening float:
 * - Cashier (POS): locked to pending_opening_float (cannot invent float).
 * - Owner/manager: may pass openingCash, else falls back to pending.
 */
export async function resolveOpeningCashForOpen(input: {
  storeId: string;
  cashierId: string;
  role: string;
  requestedOpeningCash?: number | null;
}): Promise<number> {
  const vault = await getCashierVault(input.storeId, input.cashierId);
  const pending = vault.pending_opening_float;

  if (input.role === "cashier") {
    return pending;
  }

  if (input.requestedOpeningCash == null || Number.isNaN(input.requestedOpeningCash)) {
    return pending;
  }

  const requested = roundMoney(input.requestedOpeningCash);
  if (requested < 0) {
    throw new Error("رصيد بداية الوردية لازم يكون صفر أو أكبر");
  }
  if (requested > vault.balance + 1e-9) {
    throw new Error(
      `رصيد الخزينة (${vault.balance}) غير كافٍ لرصيد بداية الوردية المطلوب`
    );
  }
  return requested;
}

export async function openSessionAction(openingCash?: number | null) {
  await requirePermissionOrRole("session_open", ["owner", "manager", "cashier"]);
  let ctx;
  try {
    ctx = await requirePosAccess();
  } catch (error) {
    if (error instanceof PosAccessError) {
      throw new Error(mapPosAccessError(error));
    }
    throw new Error(error instanceof Error ? error.message : "تعذر فتح الجلسة");
  }
  if (ctx.user.role === "cashier" && ctx.activeCashierId !== ctx.user.id) {
    throw new Error("ارجع لحسابك أو سجّل دخولك لفتح الجلسة");
  }

  const resolvedOpeningCash = await resolveOpeningCashForOpen({
    storeId: ctx.storeId,
    cashierId: ctx.activeCashierId,
    role: ctx.user.role,
    requestedOpeningCash: openingCash,
  });

  const session = await openSession({
    storeId: ctx.storeId,
    cashierId: ctx.activeCashierId,
    deviceId: ctx.deviceId,
    openingCash: resolvedOpeningCash,
  });

  revalidatePath("/sessions");
  // Avoid revalidatePath("/pos") mid-sale; POS clients call router.refresh when needed.
  return session;
}

/** POS quick-open: always uses locked pending float (or 0). */
export async function quickOpenSessionAction() {
  return openSessionAction(null);
}

export async function getPendingOpeningFloatAction(): Promise<{
  pendingOpeningFloat: number;
  vaultBalance: number;
}> {
  await requirePermissionOrRole("session_open", ["owner", "manager", "cashier"]);
  let ctx;
  try {
    ctx = await requirePosAccess();
  } catch (error) {
    if (error instanceof PosAccessError) {
      throw new Error(mapPosAccessError(error));
    }
    throw error;
  }
  const vault = await getCashierVault(ctx.storeId, ctx.activeCashierId);
  return {
    pendingOpeningFloat: vault.pending_opening_float,
    vaultBalance: vault.balance,
  };
}

export async function closeSessionAction(input: {
  sessionId: string;
  actualCash: number;
  expectedCash: number;
  reconciliationVersion: string;
  notes?: string;
}): Promise<CloseSessionResult> {
  const actualCash = validCashAmount(input.actualCash);
  if (!Number.isFinite(input.expectedCash)) {
    throw new Error("ملخص الجلسة غير صالح. أعد تحميله وحاول مرة أخرى");
  }
  const user = await requireAuth();
  const existing = await getSessionById(input.sessionId);
  if (!existing) throw new Error("الجلسة غير موجودة");

  const posCtx = await getPosAccessOrNull();
  const activeCashierId = posCtx?.activeCashierId ?? user.id;

  const canForceClose = await permissionRepo.hasPermission("session_force_close");
  const canClose =
    canForceClose ||
    (existing.cashier_id === activeCashierId &&
      (user.role !== "cashier" || activeCashierId === user.id));

  if (!canClose) throw new Error("تقدر تقفل جلستك بس");

  await requirePermissionOrRole("session_close", ["owner", "manager", "cashier"]);

  const bundle = await loadSessionCashBundle(input.sessionId);
  const reconciliation = bundle.reconciliation;
  if (
    roundMoney(input.expectedCash) !== roundMoney(reconciliation.expectedCash) ||
    input.reconciliationVersion !== getSessionReconciliationVersion(reconciliation)
  ) {
    return {
      status: "reconciliation_changed",
      reconciliation,
      expenses: bundle.expenses,
    };
  }

  let session;
  try {
    session = await closeSession({
      sessionId: input.sessionId,
      expectedCash: reconciliation.expectedCash,
      actualCash,
      notes: input.notes?.trim() || undefined,
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof SessionVaultDepositError) {
      return {
        status: "vault_pending",
        sessionId: error.sessionId,
        expectedCash: roundMoney(reconciliation.expectedCash),
        actualCash,
        variance: roundMoney(actualCash - reconciliation.expectedCash),
        message: error.message,
      };
    }
    throw error;
  }

  if (!session) throw new Error("تعذر إغلاق الجلسة. حدّث الصفحة وحاول مرة أخرى");

  revalidatePath("/sessions");
  revalidatePath("/");
  return {
    status: "closed",
    session,
    expectedCash: roundMoney(reconciliation.expectedCash),
    actualCash,
    variance: roundMoney(actualCash - reconciliation.expectedCash),
  };
}

export async function forceCloseSessionAction(input: {
  sessionId: string;
  actualCash: number;
  closeReason: string;
  notes?: string;
}) {
  const actualCash = validCashAmount(input.actualCash);
  const user = await requireAuth();
  await requirePermissionOrRole("session_force_close", ["owner", "manager"]);
  const settings = await getSessionSettings();
  if (!settings.allow_manager_force_close) {
    throw new Error("الإغلاق الإجباري معطّل من الإعدادات");
  }
  if (!input.closeReason.trim()) {
    throw new Error("سبب الإغلاق مطلوب");
  }

  const existing = await getSessionById(input.sessionId);
  if (!existing) throw new Error("الجلسة غير موجودة");
  if (existing.status !== "open") throw new Error("Session is already closed");

  const reconciliation = await calcExpectedCash(input.sessionId);
  const session = await forceCloseSession({
    sessionId: input.sessionId,
    expectedCash: reconciliation.expectedCash,
    actualCash,
    closeReason: input.closeReason.trim(),
    notes: input.notes,
    userId: user.id,
  });

  revalidatePath("/sessions");
  revalidatePath("/");
  return session;
}

export async function withdrawCashierVaultAction(input: {
  storeId: string;
  cashierId: string;
  withdrawAmount: number;
  nextOpeningFloat: number;
  notes?: string;
  destinationTreasuryId?: string | null;
}) {
  await requirePermissionOrRole(["owner", "manager"]);
  await requireStoreAccess(input.storeId);

  const vault = await withdrawFromCashierVault({
    storeId: input.storeId,
    cashierId: input.cashierId,
    withdrawAmount: input.withdrawAmount,
    nextOpeningFloat: input.nextOpeningFloat,
    notes: input.notes,
    destinationTreasuryId: input.destinationTreasuryId,
  });

  revalidatePath("/sessions");
  revalidatePath("/treasury");
  return vault;
}

export async function batchWithdrawCashierVaultsAction(input: {
  storeId: string;
  notes?: string;
  items?: Array<{ cashierId: string; withdrawAmount: number }>;
  destinationTreasuryId?: string | null;
}) {
  await requirePermissionOrRole(["owner", "manager"]);
  await requireStoreAccess(input.storeId);

  const result = await batchWithdrawStoreCashierVaults({
    storeId: input.storeId,
    notes: input.notes,
    items: input.items,
    destinationTreasuryId: input.destinationTreasuryId,
  });

  revalidatePath("/sessions");
  revalidatePath("/treasury");
  return result;
}

export async function getCashierPendingFloatPreviewAction(storeId: string, cashierId: string) {
  await requireAuth();
  await requireStoreAccess(storeId);
  return getPendingOpeningFloat(storeId, cashierId);
}
