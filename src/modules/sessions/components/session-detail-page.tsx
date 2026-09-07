import Link from "next/link";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { SessionInvoicesTable } from "@/modules/sessions/components/session-invoices-table";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import type { SessionDetail } from "@/modules/sessions/services/session-detail.service";
import type { SessionLifecycleState } from "@/lib/types";
import { CorrectSessionCashDialog } from "@/modules/sessions/components/correct-session-cash-dialog";
import { cn } from "@/lib/utils";
import { getOperationalSessionVariance } from "@/modules/sessions/lib/sessions-glance";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  });
}

function formatDuration(openedAt: string, closedAt: string | null) {
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((end - new Date(openedAt).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} دقيقة`;
  if (rest === 0) return `${hours} ساعة`;
  return `${hours} ساعة و${rest} دقيقة`;
}

interface SessionDetailPageProps {
  detail: SessionDetail;
  lifecycle?: SessionLifecycleState | null;
  canCorrectClosingCash?: boolean;
}

export function SessionDetailPage({ detail, lifecycle, canCorrectClosingCash = false }: SessionDetailPageProps) {
  const { session } = detail;
  const isOpen = session.status === "open";
  const variance = getOperationalSessionVariance(session);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumb={
          <Link href="/sessions" className="hover:text-foreground hover:underline">
            الجلسات
          </Link>
        }
        title={`جلسة ${detail.cashierName}`}
        description={`${detail.storeName} · فُتحت ${formatDateTime(session.opened_at)}${
          session.closed_at ? ` · قُفلت ${formatDateTime(session.closed_at)}` : ""
        }`}
        meta={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isOpen ? (
              lifecycle ? (
                <SessionLifecycleBadge lifecycle={lifecycle} />
              ) : (
                <Badge variant="secondary">مفتوحة</Badge>
              )
            ) : (
              <Badge variant={session.force_closed ? "destructive" : "secondary"}>
                {session.force_closed ? "إغلاق إجباري" : "مقفولة"}
              </Badge>
            )}
            {session.force_closed && session.close_reason ? (
              <span className="text-xs text-destructive">
                السبب: {session.close_reason}
                {detail.closedByName ? ` · بواسطة ${detail.closedByName}` : ""}
              </span>
            ) : null}
          </div>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {!isOpen && canCorrectClosingCash ? (
              <CorrectSessionCashDialog session={session} />
            ) : null}
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/sessions" />}
            >
              رجوع للجلسات
            </Button>
          </div>
        }
      />

      <OperationalCard
        title={isOpen ? "ملخص الوردية" : "ملخص الإقفال"}
        description="الأوقات وحركة درج الكاشير المسجلة لهذه الوردية"
        className="mb-1"
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">وقت الفتح</dt>
            <dd className="mt-1 font-medium">{formatDateTime(session.opened_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">وقت الإغلاق</dt>
            <dd className="mt-1 font-medium">
              {session.closed_at ? formatDateTime(session.closed_at) : "لسه مفتوحة"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">مدة الوردية</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {formatDuration(session.opened_at, session.closed_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">أغلقها</dt>
            <dd className="mt-1 font-medium">{detail.closedByName ?? (isOpen ? "—" : detail.cashierName)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">بداية الدرج</dt>
            <dd className="mt-1 font-semibold tabular-nums">{formatCurrency(session.opening_cash)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">المبلغ المتوقع</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {session.expected_cash == null ? "—" : formatCurrency(session.expected_cash)}
            </dd>
          </div>
          <div className="rounded-lg bg-primary/5 px-3 py-2 -m-2">
            <dt className="text-xs text-muted-foreground">اتقفلت فعليًا على</dt>
            <dd className="mt-1 text-base font-bold tabular-nums">
              {session.actual_cash == null ? "—" : formatCurrency(session.actual_cash)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">فرق الدرج</dt>
            <dd className={cn("mt-1 font-bold tabular-nums", variance < 0 ? "text-destructive" : variance > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300") }>
              {session.variance == null ? "—" : `${variance > 0 ? "+" : ""}${formatCurrency(variance)}`}
            </dd>
          </div>
        </dl>
        {detail.reconciliation ? (
          <div className="mt-4 border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold">تفاصيل حركة الوردية</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
              {[
                ["مبيعات نقدي", detail.reconciliation.cashSales],
                ["مبيعات بطاقة", detail.reconciliation.cardSales],
                ["مبيعات محفظة", detail.reconciliation.walletSales],
                ["مبيعات آجل", detail.reconciliation.creditSales],
                ["مرتجعات نقدية", -detail.reconciliation.cashRefunds],
                ["مصروفات من الدرج", -detail.reconciliation.expenses],
                ["تحصيلات عملاء", detail.reconciliation.customerPayments],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-medium tabular-nums">{formatCurrency(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        {(session.close_reason || session.notes) ? (
          <div className="mt-4 border-t pt-3 text-sm">
            {session.close_reason ? <p><span className="text-muted-foreground">سبب الإغلاق:</span> {session.close_reason}</p> : null}
            {session.notes ? <p className="mt-1"><span className="text-muted-foreground">ملاحظات:</span> {session.notes}</p> : null}
          </div>
        ) : null}
      </OperationalCard>

      <div className="grid grid-cols-2 gap-[var(--mds-space-3)] sm:gap-[var(--mds-space-4)] lg:grid-cols-3">
        <OperationalCard
          title="الفواتير المكتملة"
          value={String(detail.orderCount)}
          subtitle={`من أصل ${detail.invoices.length} فاتورة`}
          accent="var(--mds-color-feedback-info)"
        />
        <OperationalCard
          title="إجمالي المبيعات"
          value={formatCurrency(detail.totalSales)}
          subtitle="الفواتير المكتملة فقط"
          accent="var(--mds-color-feedback-success)"
        />
        <OperationalCard
          title="بعميل"
          value={String(detail.invoicesWithCustomer)}
          subtitle={
            detail.invoices.length > 0
              ? `${detail.invoices.length - detail.invoicesWithCustomer} بدون عميل`
              : "مفيش فواتير بعد"
          }
        />
      </div>

      <section className="flex flex-col gap-[var(--mds-space-3)]">
        <h2 className="font-heading text-base font-semibold">فواتير الجلسة</h2>
        <SessionInvoicesTable invoices={detail.invoices} />
      </section>
    </div>
  );
}
