import Link from "next/link";
import { AccessDenied } from "@/components/Velora/access-denied";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import * as storeRepo from "@/lib/repositories/store.repository";
import { PageHeader } from "@/components/Velora/page-header";
import { PageShell } from "@/components/Velora/page-patterns";
import { buttonVariants } from "@/components/ui/button";
import { OrdersTable } from "@/modules/orders/components/orders-table";
import { listOrders } from "@/modules/orders/services/order.service";
import { getBusinessActivitySettings } from "@/modules/system/services/settings.service";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function OrdersPage() {
  const storeResult = await requirePageStoreId("/orders");
  if (!storeResult.ok) {
    return (
      <AccessDenied title={storeResult.denial.title} description={storeResult.denial.description} />
    );
  }
  const storeId = storeResult.storeId;
  const [store, activity] = await Promise.all([
    storeRepo.getStore(storeId),
    getBusinessActivitySettings(),
  ]);
  const orders = (await listOrders(storeId)).map((o) => ({
    ...o,
    storeName: store?.name ?? "الفرع",
  }));

  const completed = orders.filter((o) => o.status === "completed");
  const voided = orders.filter((o) => o.status === "voided" || o.status === "refunded");
  const salesTotal = completed.reduce((sum, o) => sum + o.total, 0);

  return (
    <PageShell>
      <PageHeader
        breadcrumb={<span>المبيعات · الطلبات</span>}
        title="الطلبات"
        description="فواتير مكتملة وملغاة — راجع وأعد الطباعة عند الحاجة"
        action={
          activity.enable_wholesale_sales ? (
            <Link
              href="/sales-invoices"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}
            >
              فاتورة جملة جديدة
            </Link>
          ) : undefined
        }
      />

      <section aria-label="ملخص الطلبات" className="overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card">
        <dl className="grid grid-cols-2 sm:grid-cols-3">
          <div className="border-b border-border px-4 py-4 sm:border-b-0"><dt className="text-xs font-medium text-muted-foreground">إجمالي المبيعات</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(salesTotal)}</dd><dd className="text-xs text-muted-foreground">{completed.length} طلب مكتمل</dd></div>
          <div className="border-b border-border px-4 py-4 sm:border-b-0 sm:border-s"><dt className="text-xs font-medium text-muted-foreground">كل الطلبات</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{orders.length}</dd><dd className="text-xs text-muted-foreground">{store?.name ?? "الفرع"}</dd></div>
          <div className="col-span-2 px-4 py-4 sm:col-span-1 sm:border-s"><dt className="text-xs font-medium text-muted-foreground">ملغي أو مسترد</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-[var(--mds-color-feedback-danger)]">{voided.length}</dd><dd className="text-xs text-muted-foreground">يحتاج مراجعة عند الارتفاع</dd></div>
        </dl>
      </section>

      <OrdersTable orders={orders} />
    </PageShell>
  );
}
