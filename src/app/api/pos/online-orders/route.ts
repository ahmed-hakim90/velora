import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/guards";
import { PosAccessError, requirePosAccess } from "@/lib/auth/pos-access";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { listActiveOnlineOrdersWithItems } from "@/modules/online-orders/services/online-order.service";

export const dynamic = "force-dynamic";

/** Active online orders for POS without remounting the page. */
export async function GET() {
  try {
    const ctx = await requirePosAccess({ touchSeen: false });
    if (
      !["owner", "manager", "cashier"].includes(ctx.user.role) &&
      !(await permissionRepo.hasPermission("checkout_create"))
    ) {
      throw new AuthError("مفيش صلاحية للعملية دي", 403);
    }
    const orders = await listActiveOnlineOrdersWithItems(ctx.storeId);
    return NextResponse.json({
      storeId: ctx.storeId,
      orders,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status =
      error instanceof AuthError
        ? error.status ?? 403
        : error instanceof PosAccessError
          ? error.code === "login_required"
            ? 401
            : 403
          : 500;
    const message =
      error instanceof Error ? error.message : "فشل تحميل الطلبات الأونلاين";
    return NextResponse.json({ error: message }, { status });
  }
}
