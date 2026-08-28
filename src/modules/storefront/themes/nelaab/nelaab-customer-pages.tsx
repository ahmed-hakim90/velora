"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { StorefrontCustomerAuth } from "../../components/storefront-customer-auth";
import {
  STOREFRONT_ORDER_STATUSES,
  STOREFRONT_ORDER_STATUS_LABELS_AR,
  type StorefrontOrderStatus,
} from "../../core/order-lifecycle";
import type { StorefrontThemePageProps } from "../../core/types";
import { buildStorefrontPath } from "../../core/urls";
function statusLabel(status: string) {
  return STOREFRONT_ORDER_STATUSES.includes(status as StorefrontOrderStatus)
    ? STOREFRONT_ORDER_STATUS_LABELS_AR[status as StorefrontOrderStatus]
    : status;
}

export function NelaabLoginPage({
  storefront,
  authError,
  customerAccount,
}: StorefrontThemePageProps) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-black">دخول حساب العميل</h1>
      <p className="mt-2 text-[var(--sf-muted)]">
        احتفظ بطلباتك وعناوينك في مكان واحد، أو استمر كضيف بدون حساب.
      </p>
      <div className="mt-7">
        <StorefrontCustomerAuth
          slug={storefront.slug}
          token={storefront.token}
          previewToken={storefront.previewToken}
          nextPath="account"
          initialError={authError}
          signedInAs={customerAccount?.email ?? customerAccount?.displayName}
        />
      </div>
      <Link
        href={buildStorefrontPath(storefront, "/shop")}
        className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-[var(--sf-border)] bg-white px-4 font-bold"
      >
        متابعة التسوق كضيف
      </Link>
    </main>
  );
}

export function NelaabAccountPage({
  storefront,
  customerAccount,
  authError,
}: StorefrontThemePageProps) {
  const router = useRouter();
  if (!customerAccount)
    return (
      <NelaabLoginPage
        storefront={storefront}
        authError={authError}
        customerAccount={customerAccount}
      />
    );
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--sf-primary)]">
            حساب العميل
          </p>
          <h1 className="mt-1 text-3xl font-black">
            أهلًا {customerAccount.displayName}
          </h1>
          {customerAccount.email ? (
            <p className="mt-2 text-sm text-[var(--sf-muted)]" dir="ltr">
              {customerAccount.email}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={async () => {
            await createClient().auth.signOut();
            router.refresh();
          }}
          className="min-h-11 rounded-xl border border-[var(--sf-border)] bg-white px-4 text-sm font-bold"
        >
          تسجيل الخروج
        </button>
      </div>
      {!customerAccount.customerId ? (
        <div className="mt-6 rounded-2xl border border-[var(--sf-border)] bg-white p-5">
          <h2 className="font-extrabold">حسابك جاهز</h2>
          <p className="mt-2 text-sm text-[var(--sf-muted)]">
            بعد أول طلب برقم الموبايل هنربط طلباتك وعناوينك تلقائيًا بهذا
            الحساب.
          </p>
          <Link
            href={buildStorefrontPath(storefront, "/checkout")}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--sf-accent)] px-4 font-bold"
          >
            إتمام أول طلب
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="text-xl font-black">طلباتي</h2>
            {customerAccount.orders.length ? (
              <div className="mt-4 space-y-3">
                {customerAccount.orders.map((order) => (
                  <Link
                    key={order.orderNumber}
                    href={buildStorefrontPath(
                      storefront,
                      `/order/${order.trackingToken}`,
                    )}
                    className="block rounded-2xl border border-[var(--sf-border)] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="font-mono text-[var(--sf-primary)]">
                          {order.orderNumber}
                        </strong>
                        <p className="mt-1 text-xs text-[var(--sf-muted)]">
                          {new Intl.DateTimeFormat("ar-EG", {
                            dateStyle: "medium",
                          }).format(new Date(order.placedAt))}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F1EDFF] px-3 py-1 text-xs font-bold text-[var(--sf-primary)]">
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-3 font-extrabold">
                      {formatCurrency(order.grandTotal, order.currency)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--sf-border)] p-8 text-center">
                <ShoppingBag className="mx-auto size-9 text-[var(--sf-primary)]" />
                <p className="mt-3 font-bold">مفيش طلبات مرتبطة بالحساب لسه.</p>
              </div>
            )}
          </section>
          <aside>
            <h2 className="text-xl font-black">عناويني</h2>
            {customerAccount.addresses.length ? (
              <div className="mt-4 space-y-3">
                {customerAccount.addresses.map((address) => (
                  <article
                    key={address.id}
                    className="rounded-2xl border border-[var(--sf-border)] bg-white p-4"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-[var(--sf-primary)]" />
                      <strong>{address.label}</strong>
                      {address.isDefault ? (
                        <span className="ms-auto rounded-full bg-[#E7FAF7] px-2 py-1 text-[10px] font-bold text-[#007B72]">
                          الافتراضي
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--sf-muted)]">
                      {[address.addressLine, address.area, address.city]
                        .filter(Boolean)
                        .join("، ")}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--sf-border)] p-5 text-sm text-[var(--sf-muted)]">
                العناوين المستخدمة في طلبات التوصيل هتظهر هنا.
              </p>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
