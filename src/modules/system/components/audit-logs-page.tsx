"use client";

import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { useEffect, useState, useTransition } from "react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import {
  EmptyStateBlock,
  LoadingStateBlock,
} from "@/components/Velora/state-blocks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateRangeFilter } from "@/components/Velora/date-range-filter";
import { formatDateTime } from "@/lib/format";
import type { AppUser, AuditLog, Store } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

interface AuditLogsPageProps {
  logs: AuditLog[];
  users: AppUser[];
  stores: Store[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  initialFilters: {
    storeId?: string;
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  };
  embedded?: boolean;
}

export function AuditLogsPage({
  logs,
  users,
  stores,
  page,
  pageSize,
  hasMore,
  initialFilters,
  embedded,
}: AuditLogsPageProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [dateRange, setDateRange] = useState({
    from: initialFilters.from?.slice(0, 10) ?? "",
    to: initialFilters.to?.slice(0, 10) ?? "",
  });
  useEffect(() => {
    setDateRange({
      from: initialFilters.from?.slice(0, 10) ?? "",
      to: initialFilters.to?.slice(0, 10) ?? "",
    });
  }, [initialFilters.from, initialFilters.to]);
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();

  function buildParams(form?: FormData, nextPage?: number) {
    const params = new URLSearchParams();
    if (embedded) params.set("tab", "audit");
    const storeId =
      form?.get("storeId")?.toString() ?? searchParams.get("storeId") ?? "";
    const userId =
      form?.get("userId")?.toString() ?? searchParams.get("userId") ?? "";
    const action =
      form?.get("action")?.toString() ?? searchParams.get("action") ?? "";
    const from =
      form?.get("from")?.toString() ?? searchParams.get("from") ?? "";
    const to =
      form?.get("to")?.toString() ?? searchParams.get("to")?.slice(0, 10) ?? "";
    if (storeId) params.set("storeId", storeId);
    if (userId) params.set("userId", userId);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(nextPage ?? 1));
    return params;
  }

  const auditPath = embedded ? "/settings" : "/audit";

  function applyFilters(form: FormData) {
    startTransition(() => {
      router.push(`${auditPath}?${buildParams(form, 1).toString()}`);
    });
  }

  return (
    <div
      className="flex flex-col gap-3"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {embedded ? null : (
        <PageHeader
          title={t("Activity log")}
          description={t(
            "Sensitive actions and system events for owners and managers.",
          )}
        />
      )}

      <OperationalCard title={t("Filters")}>
        <form
          action={applyFilters}
          className="grid grid-cols-2 gap-[var(--mds-space-4)] lg:grid-cols-5"
        >
          <div className="space-y-[var(--mds-space-2)]">
            <Label htmlFor="audit-action">{t("Action")}</Label>
            <select
              id="audit-action"
              name="action"
              defaultValue={
                initialFilters.action ?? searchParams.get("action") ?? ""
              }
              className="h-9 w-full rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm"
            >
              <option value="">{t("All actions")}</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-[var(--mds-space-2)]">
            <Label htmlFor="audit-user">{t("User")}</Label>
            <select
              id="audit-user"
              name="userId"
              defaultValue={
                initialFilters.userId ?? searchParams.get("userId") ?? ""
              }
              className="h-9 w-full rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm"
            >
              <option value="">{t("All users")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 space-y-[var(--mds-space-2)] sm:col-span-1">
            <Label htmlFor="audit-store">{t("Store")}</Label>
            <select
              id="audit-store"
              name="storeId"
              defaultValue={
                initialFilters.storeId ?? searchParams.get("storeId") ?? ""
              }
              className="h-9 w-full rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm"
            >
              <option value="">{t("All stores")}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <input type="hidden" name="from" value={dateRange.from} />
            <input type="hidden" name="to" value={dateRange.to} />
          </div>
          <div className="col-span-2 flex flex-row flex-wrap items-end gap-2 lg:col-span-5">
            <Button
              type="submit"
              disabled={pending}
              className="shadow-[var(--mds-elevation-1)]"
            >
              {t("Apply filters")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-[var(--mds-radius-md)]"
              onClick={() =>
                router.push(embedded ? "/settings?tab=audit" : "/audit")
              }
            >
              {t("Clear")}
            </Button>
          </div>
        </form>
      </OperationalCard>

      <OperationalCard title={`${t("Recent activity")} (${t("Page")} ${page})`}>
        {pending && logs.length === 0 ? (
          <LoadingStateBlock label={t("Loading activity log...")} />
        ) : logs.length === 0 ? (
          <EmptyStateBlock
            title={t("No events match these filters")}
            description={t(
              "Change the filters or widen the date range to see more activity.",
            )}
            className="border-0 bg-transparent shadow-none"
          />
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((log) => (
              <li key={log.id} className="py-[var(--mds-space-3)]">
                <div className="flex flex-col gap-[var(--mds-space-2)] sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{log.action}</p>
                    <p className="break-words text-sm text-muted-foreground">
                      {log.entity_type} · {log.entity_id}
                      {log.store_id
                        ? ` · ${storeMap.get(log.store_id) ?? log.store_id}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-end">
                    <p className="break-words">
                      {userMap.get(log.user_id) ?? log.user_id}
                    </p>
                    <p>{formatDateTime(log.created_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-[var(--mds-space-4)] flex flex-col gap-[var(--mds-space-3)] border-t border-border pt-[var(--mds-space-4)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t("Up to")} {pageSize} {t("records per page")}
          </p>
          <div className="flex gap-[var(--mds-space-2)] sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 rounded-[var(--mds-radius-md)] sm:flex-none"
              disabled={page <= 1 || pending}
              onClick={() =>
                startTransition(() =>
                  router.push(
                    `${auditPath}?${buildParams(undefined, page - 1).toString()}`,
                  ),
                )
              }
            >
              {t("Previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 rounded-[var(--mds-radius-md)] sm:flex-none"
              disabled={!hasMore || pending}
              onClick={() =>
                startTransition(() =>
                  router.push(
                    `${auditPath}?${buildParams(undefined, page + 1).toString()}`,
                  ),
                )
              }
            >
              {t("Next")}
            </Button>
          </div>
        </div>
      </OperationalCard>
    </div>
  );
}
