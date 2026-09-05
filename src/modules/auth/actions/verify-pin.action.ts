"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  setActiveCashierId,
  getCurrentUser,
  getActiveStoreId,
} from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";

export interface VerifyPinResult {
  success: boolean;
  error?: string;
  cashierId?: string;
}

/** Lock POS screen — keeps login + register cookie; PIN required again. */
export async function lockPosCashierAction(): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await setActiveCashierId(null);
    revalidatePath("/pos");
    revalidatePath("/sessions");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "تعذر قفل الشاشة",
    };
  }
}

export async function verifyPinAction(pin: string): Promise<VerifyPinResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "لازم تسجّل الدخول أولاً." };
  }

  if (!pin || pin.length < 4) {
    return { success: false, error: "أدخل PIN صالح (4 أرقام على الأقل)." };
  }

  const storeId = await getActiveStoreId();
  if (!storeId) {
    return { success: false, error: "مفيش فرع نشط مختار." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_cashier_pin", {
    p_store_id: storeId,
    p_pin: pin,
  });

  if (error || !data) {
    try {
      const orgId = await getOrgId();
      await writeAuditLog({
        orgId,
        storeId,
        userId: user.id,
        action: "cashier.pin_failed",
        entityType: "user",
        entityId: user.id,
        metadata: {},
      });
    } catch {
      // ignore audit errors
    }
    return { success: false, error: "الرقم السري غلط." };
  }

  const cashierId = data as string;
  await setActiveCashierId(cashierId, {
    storeId,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId,
    userId: cashierId,
    action: "cashier.pin_verified",
    entityType: "user",
    entityId: cashierId,
    metadata: { verifiedBy: user.id },
  });

  revalidatePath("/pos");
  revalidatePath("/sessions");
  return { success: true, cashierId };
}
