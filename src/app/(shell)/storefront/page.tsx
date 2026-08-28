import Link from "next/link";
import {
  ExternalLink,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
} from "lucide-react";
import { AccessDenied } from "@/components/Velora/access-denied";
import { PageHeader } from "@/components/Velora/page-header";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { getStore } from "@/lib/repositories/store.repository";
import { getOrganization } from "@/lib/repositories/organization.repository";
import { formatCurrency } from "@/lib/format";
import { StorefrontAdminSubnav } from "@/modules/storefront/components/storefront-admin-subnav";
import { getStorefrontDashboardSummary } from "@/modules/storefront/services/storefront-dashboard.service";
import { buildStorefrontPath } from "@/modules/storefront/core/urls";

export default async function StorefrontOverviewPage() {
  const access = await requirePageStoreId("/storefront");
  if (!access.ok)
    return (
      <AccessDenied
        title={access.denial.title}
        description={access.denial.description}
      />
    );
  const [store, organization] = await Promise.all([
    getStore(access.storeId),
    getOrganization(),
  ]);
  if (!store)
    return (
      <AccessDenied
        title="الفرع غير موجود"
        description="اختر فرعًا متاحًا ثم حاول مرة أخرى."
      />
    );
  const summary = await getStorefrontDashboardSummary(
    store.id,
    organization.currency,
  );
  const slug =
    typeof store.settings.storefront_slug === "string"
      ? store.settings.storefront_slug
      : "";
  const storefrontHref = slug
    ? buildStorefrontPath({
        slug,
        token:
          store.settings.storefront_unlisted === true &&
          typeof store.settings.storefront_token === "string"
            ? store.settings.storefront_token
            : null,
      })
    : "";
  const cards = [
    {
      label: "منتجات منشورة",
      value: `${summary.publishedProducts} / ${summary.totalProducts}`,
      href: "/storefront/products",
      icon: Package,
    },
    {
      label: "طلبات تحتاج متابعة",
      value: String(summary.pendingOrders),
      href: "/storefront/orders",
      icon: Receipt,
    },
    {
      label: "إجمالي الطلبات",
      value: String(summary.totalOrders),
      href: "/storefront/orders",
      icon: ShoppingBag,
    },
    {
      label: "مبيعات تم تسليمها",
      value: formatCurrency(summary.revenue, summary.currency),
      href: "/storefront/orders",
      icon: ShoppingBag,
    },
  ];
  return (
    <div dir="rtl" className="space-y-5">
      <PageHeader
        title="المتجر الإلكتروني"
        description="تابع جاهزية المتجر ومنتجاته وطلباته من موديول مستقل."
      />
      <StorefrontAdminSubnav active="/storefront" />
      {!summary.databaseReady ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900"
        >
          طبّق migration المتجر لتفعيل الطلبات وحسابات العملاء. إدارة المنتجات
          الأساسية ما زالت متاحة.
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 text-sm text-muted-foreground">{card.label}</p>
              <strong className="mt-1 block text-2xl">{card.value}</strong>
            </Link>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold">حالة النشر</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt>المتجر</dt>
              <dd className="font-bold">
                {store.settings.storefront_enabled === true ? "مفعّل" : "متوقف"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>استقبال الطلبات</dt>
              <dd className="font-bold">
                {store.settings.storefront_ordering_enabled === true
                  ? "مفعّل"
                  : "متوقف"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>الدومين</dt>
              <dd className="font-bold">
                {store.settings.storefront_domain_enabled === true
                  ? "يفتح المتجر"
                  : "غير مخصص"}
              </dd>
            </div>
          </dl>
          <Link
            href="/storefront/settings"
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold"
          >
            <Settings className="size-4" />
            إدارة الإعدادات
          </Link>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold">واجهة المتجر</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            عاين تجربة العميل بعد حفظ المسودة أو افتح النسخة المنشورة.
          </p>
          {storefrontHref ? (
            <Link
              href={storefrontHref}
              target="_blank"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              فتح المتجر <ExternalLink className="size-4" />
            </Link>
          ) : (
            <p className="mt-4 rounded-xl bg-muted p-3 text-sm">
              حدد رابط المتجر من الإعدادات أولًا.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
