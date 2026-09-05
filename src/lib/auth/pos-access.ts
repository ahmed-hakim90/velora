import { requireAuth } from "@/lib/auth/guards";
import {
  getActiveCashierId,
  getActiveStoreId,
  setActiveCashierId,
} from "@/lib/auth/session";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import type { AppUser } from "@/lib/types";
export class PosAccessError extends Error {
  constructor(
    message: string,
    public code:
      | "login_required"
      | "store_mismatch"
      | "store_required"
      | "access_denied"
      | "cashier_required"
      | "role_denied",
  ) {
    super(message);
    this.name = "PosAccessError";
  }
}

export interface PosAccessContext {
  user: AppUser;
  storeId: string;
  deviceId: string | null;
  activeCashierId: string;
}

export async function resolvePosAccess(
  options: {
    requireCashierRole?: boolean;
    clearInvalidCashier?: boolean;
    /** Only server actions/route handlers may persist cashier cookies. */
    persistCookies?: boolean;
    /** Heartbeat write — skip on read-only chrome/page readiness checks. */
    touchSeen?: boolean;
  } = {},
): Promise<PosAccessContext> {
  const persistCookies = options.persistCookies ?? false;
  let user: AppUser;
  try {
    user = await requireAuth();
  } catch {
    throw new PosAccessError("Sign in required", "login_required");
  }

  const roleHasPosAccess = ["owner", "manager", "cashier"].includes(user.role);
  const permissionHasPosAccess = roleHasPosAccess
    ? true
    : await permissionRepo.hasPermission("pos_access").catch(() => false);
  if (!permissionHasPosAccess) {
    throw new PosAccessError("POS not available for this role", "role_denied");
  }

  if (options.requireCashierRole && user.role !== "cashier") {
    throw new PosAccessError("Cashier account required", "role_denied");
  }

  const storeId = await getActiveStoreId();
  if (!storeId) {
    throw new PosAccessError("Select a store to continue", "store_required");
  }

  if (
    user.role !== "owner" &&
    user.role !== "manager" &&
    !user.store_ids.includes(storeId)
  ) {
    throw new PosAccessError("Store access denied", "access_denied");
  }

  let activeCashierId = await getActiveCashierId(storeId, null, user);
  if (!activeCashierId) {
    // Cashier already logged in via PIN/email — unlock as self without a second PIN.
    if (user.role === "cashier") {
      if (persistCookies) {
        await setActiveCashierId(user.id, { storeId });
      }
      activeCashierId = user.id;
    } else {
      // Owner/manager: PIN switch selects which cashier identity sells.
      throw new PosAccessError("Cashier PIN required", "cashier_required");
    }
  }

  if (user.role === "cashier" && activeCashierId !== user.id) {
    if (options.clearInvalidCashier && persistCookies) {
      await setActiveCashierId(null);
    }
    throw new PosAccessError("You can only use your own cashier account", "access_denied");
  }

  return {
    user,
    storeId,
    deviceId: null,
    activeCashierId,
  };
}

export async function requirePosAccess(
  options: { requireCashierRole?: boolean; touchSeen?: boolean } = {},
): Promise<PosAccessContext> {
  const ctx = await resolvePosAccess({
    ...options,
    clearInvalidCashier: true,
    persistCookies: true,
    touchSeen: options.touchSeen ?? true,
  });
  return ctx;
}

export async function getPosAccessOrNull(): Promise<PosAccessContext | null> {
  try {
    return await resolvePosAccess({
      clearInvalidCashier: true,
      touchSeen: false,
    });
  } catch (e) {
    if (e instanceof PosAccessError) return null;
    throw e;
  }
}

export async function requireCashierOwnSession(
  ctx: PosAccessContext,
  sessionCashierId: string,
): Promise<void> {
  if (sessionCashierId !== ctx.activeCashierId) {
    throw new PosAccessError(
      "You can only manage the active cashier session",
      "access_denied",
    );
  }
  if (ctx.user.role === "cashier" && ctx.activeCashierId !== ctx.user.id) {
    throw new PosAccessError(
      "You can only manage your own session",
      "access_denied",
    );
  }
}

export async function getActiveSessionForPos(ctx: PosAccessContext) {
  return getActiveSession(ctx.storeId, ctx.activeCashierId);
}
