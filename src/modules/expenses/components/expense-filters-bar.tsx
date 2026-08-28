"use client";

import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import type { CostCenter, ExpenseCategory } from "@/lib/types";
import { EXPENSE_SOURCES, EXPENSE_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/Velora/date-range-filter";

const SOURCE_LABELS: Record<string, string> = {
  session_cash: "نقدية الجلسة",
  external: "خارجي",
  purchase: "شراء",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الموافقة",
  approved: "معتمد",
};

interface ExpenseFiltersBarProps {
  costCenters: CostCenter[];
  categories: ExpenseCategory[];
  values: {
    costCenterId: string;
    categoryId: string;
    source: string;
    status: string;
    from: string;
    to: string;
  };
}

export function ExpenseFiltersBar({ costCenters, categories, values }: ExpenseFiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.replace(`/expenses?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid grid-cols-2 items-end gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)] lg:grid-cols-3 xl:grid-cols-4">
      <div className="min-w-0 space-y-1">
        <label className="text-xs text-muted-foreground">مركز التكلفة</label>
        <select
          value={values.costCenterId}
          onChange={(e) => apply({ costCenterId: e.target.value, categoryId: "" })}
          className="flex h-9 w-full min-w-0 rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">الكل</option>
          {costCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 space-y-1">
        <label className="text-xs text-muted-foreground">التصنيف</label>
        <select
          value={values.categoryId}
          onChange={(e) => {
            const categoryId = e.target.value;
            const category = categories.find((c) => c.id === categoryId);
            apply({
              categoryId,
              ...(category && !values.costCenterId
                ? { costCenterId: category.cost_center_id }
                : {}),
            });
          }}
          className="flex h-9 w-full min-w-0 rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">الكل</option>
          {categories
            .filter((c) => !values.costCenterId || c.cost_center_id === values.costCenterId)
            .map((c) => {
              const centerName = costCenters.find((center) => center.id === c.cost_center_id)?.name;
              return (
                <option key={c.id} value={c.id}>
                  {values.costCenterId || !centerName ? c.name : `${c.name} — ${centerName}`}
                </option>
              );
            })}
        </select>
      </div>
      <div className="min-w-0 space-y-1">
        <label className="text-xs text-muted-foreground">المصدر</label>
        <select
          value={values.source}
          onChange={(e) => apply({ source: e.target.value })}
          className="flex h-9 w-full min-w-0 rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">الكل</option>
          {EXPENSE_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 space-y-1">
        <label className="text-xs text-muted-foreground">الحالة</label>
        <select
          value={values.status}
          onChange={(e) => apply({ status: e.target.value })}
          className="flex h-9 w-full min-w-0 rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">الكل</option>
          {EXPENSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>
      <DateRangeFilter
        value={{ from: values.from, to: values.to }}
        className="col-span-2 lg:col-span-3 xl:col-span-4"
        onChange={(next) => apply({ from: next.from, to: next.to })}
      />
      <Button
        variant="outline"
        size="sm"
        className="col-span-2 h-9 w-full lg:col-span-1 xl:col-span-2"
        onClick={() => router.replace("/expenses", { scroll: false })}
      >
        مسح الفلاتر
      </Button>
    </div>
  );
}
