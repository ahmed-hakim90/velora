import { NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  AuthError,
  requireFeature,
  requirePermissionOrRole,
  getValidatedActiveStoreId,
} from "@/lib/auth/guards";
import { requirePosAccess, getActiveSessionForPos } from "@/lib/auth/pos-access";
import { createSupplierPayment } from "@/modules/suppliers/services/supplier.service";
import * as treasuryRepo from "@/lib/repositories/cash-treasury.repository";
import type { PaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Record supplier payment from POS without remounting the POS RSC tree. */
export async function POST(request: Request) {
  try {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("supplier_payment_record", [
      "owner",
      "manager",
    ]);
    const body = (await request.json()) as {
      supplierId?: string;
      amount?: number;
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      cashSource?: "drawer" | "treasury";
      treasuryId?: string;
    };

    if (!body.supplierId) {
      return NextResponse.json(
        { success: false, error: "المورد مطلوب" },
        { status: 400 }
      );
    }
    if (!(typeof body.amount === "number" && body.amount > 0 && Number.isFinite(body.amount))) {
      return NextResponse.json(
        { success: false, error: "أدخل مبلغ دفع صحيح" },
        { status: 400 }
      );
    }
    if (!body.paymentMethod) {
      return NextResponse.json(
        { success: false, error: "طريقة الدفع مطلوبة" },
        { status: 400 }
      );
    }
    if (body.paymentMethod === "cash" && body.cashSource === "treasury" && !body.treasuryId) {
      return NextResponse.json(
        { success: false, error: "اختار خزينة الفرع اللي هيتصرف منها المبلغ" },
        { status: 400 }
      );
    }

    const ctx = await requirePosAccess({ touchSeen: false });
    const session = await getActiveSessionForPos(ctx);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "لازم تكون الجلسة مفتوحة عشان تسجّل دفعة مورد" },
        { status: 400 }
      );
    }

    const storeId = await getValidatedActiveStoreId();
    if (session.store_id !== storeId) {
      return NextResponse.json(
        { success: false, error: "الجلسة لا تتبع الفرع الحالي" },
        { status: 400 }
      );
    }

    const payFromTreasury =
      body.paymentMethod === "cash" && body.cashSource === "treasury";
    if (payFromTreasury) {
      const treasury = await treasuryRepo.getTreasury(body.treasuryId!);
      if (!treasury || treasury.kind !== "store" || treasury.store_id !== storeId) {
        return NextResponse.json(
          { success: false, error: "الخزينة المختارة لا تتبع الفرع الحالي" },
          { status: 400 }
        );
      }
    }

    await createSupplierPayment({
      supplierId: body.supplierId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      reference: body.reference,
      notes: body.notes,
      storeId,
      createdBy: user.id,
      sessionId: payFromTreasury ? null : session.id,
      treasuryId: payFromTreasury ? body.treasuryId : null,
    });

    after(() => {
      revalidatePath("/inventory/suppliers");
      revalidatePath(`/inventory/suppliers/${body.supplierId}`);
      revalidatePath("/sessions");
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    const message =
      error instanceof Error ? error.message : "تعذر تسجيل دفعة المورد";
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
