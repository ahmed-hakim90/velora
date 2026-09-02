import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/guards";
import { requirePosAccess, getActiveSessionForPos } from "@/lib/auth/pos-access";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { loadSessionCashBundle } from "@/modules/sessions/services/reconciliation.service";

export const dynamic = "force-dynamic";

/** Live session cash totals for POS close — avoids stale RSC props after API checkout. */
export async function GET(request: Request) {
  try {
    const ctx = await requirePosAccess({ touchSeen: false });
    if (
      !["owner", "manager", "cashier"].includes(ctx.user.role) &&
      !(await permissionRepo.hasPermission("session_close"))
    ) {
      throw new AuthError("مفيش صلاحية للعملية دي", 403);
    }
    const session = await getActiveSessionForPos(ctx);
    if (!session) {
      return NextResponse.json({ error: "لا توجد جلسة نشطة" }, { status: 404 });
    }
    const requestedSessionId = new URL(request.url).searchParams.get("sessionId");
    if (requestedSessionId && requestedSessionId !== session.id) {
      return NextResponse.json(
        { error: "الجلسة المعروضة لا تطابق الجلسة النشطة. حدّث الصفحة وحاول مرة أخرى." },
        { status: 409 }
      );
    }

    const bundle = await loadSessionCashBundle(session.id);
    return NextResponse.json({
      sessionId: session.id,
      reconciliation: bundle.reconciliation,
      expenses: bundle.expenses,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    const message =
      error instanceof Error ? error.message : "فشل تحميل ملخص الجلسة";
    return NextResponse.json({ error: message }, { status });
  }
}
