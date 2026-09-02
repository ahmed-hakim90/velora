import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/guards";
import { requirePosAccess } from "@/lib/auth/pos-access";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { getCatalogForPOS } from "@/modules/pos/services/catalog.service";

export const dynamic = "force-dynamic";

/** Catalog for POS without remounting the page RSC tree. */
export async function GET() {
  try {
    const ctx = await requirePosAccess({ touchSeen: false });
    if (
      !["owner", "manager", "cashier"].includes(ctx.user.role) &&
      !(await permissionRepo.hasPermission("checkout_create"))
    ) {
      throw new AuthError("مفيش صلاحية للعملية دي", 403);
    }
    const { categories, products } = await getCatalogForPOS(ctx.storeId);
    return NextResponse.json({
      storeId: ctx.storeId,
      categories,
      products,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status = error instanceof AuthError ? (error.status ?? 403) : 500;
    const message =
      error instanceof Error ? error.message : "فشل تحميل قائمة المنتجات";
    return NextResponse.json({ error: message }, { status });
  }
}
