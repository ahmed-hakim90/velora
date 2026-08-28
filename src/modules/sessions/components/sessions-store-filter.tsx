"use client";

import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Label } from "@/components/ui/label";
import type { Store } from "@/lib/types";
import { DateRangeFilter } from "@/components/Velora/date-range-filter";

interface SessionsStoreFilterProps {
  stores: Store[];
  value: string;
  from?: string;
  to?: string;
  hideStore?: boolean;
}

export function SessionsStoreFilter({ stores, value, from = "", to = "", hideStore = false }: SessionsStoreFilterProps) {
  const router = useRouter();

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([key, next]) => next ? params.set(key, next) : params.delete(key));
    const query = params.toString();
    router.replace(query ? `/sessions?${query}` : "/sessions", { scroll: false });
  }

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
      {!hideStore ? <>
      <Label htmlFor="sessions-store-filter" className="sr-only">
        الفرع
      </Label>
      <select
        id="sessions-store-filter"
        className="flex h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3 text-sm sm:h-9 sm:w-auto"
        value={value}
        onChange={(e) => {
          apply({ storeId: e.target.value === "all" ? "" : e.target.value });
        }}
      >
        <option value="all">كل الفروع</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
      </> : null}
      <DateRangeFilter value={{ from, to }} onChange={(next) => apply(next)} />
    </div>
  );
}
