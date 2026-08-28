"use client";

import { useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Package,
  Scale,
  Warehouse,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompactAction } from "@/components/Velora/compact-actions";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportProductStockCardExcel } from "@/modules/reports/actions/product-stock-card.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type {
  ProductStockCardLine,
  ProductStockCardReport,
} from "@/modules/reports/services/product-stock-card.service";
import { selectLabelById } from "@/lib/select-label";
import type { Store, Warehouse as WarehouseType } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";
import { DateRangeFilter } from "@/components/Velora/date-range-filter";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unitLabel: string;
}

interface ProductStockCardViewProps {
  filters: ReportFilters;
  stores: Store[];
  warehouses: WarehouseType[];
  products: ProductOption[];
  currency: string;
  context: ReportContext;
  report: ProductStockCardReport | null;
  rangeDays: number;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("ar-EG", {
    maximumFractionDigits: 4,
    numberingSystem: "latn",
  });
}

const stockCardLabelsEn: Record<string, string> = {
  بيع: "Sale",
  شراء: "Purchase",
  "شراء من جلسة": "Purchase from session",
  "تحويل وارد": "Transfer in",
  "تحويل صادر": "Transfer out",
  هدر: "Waste",
  تعديل: "Adjustment",
  جرد: "Stock count",
  حجز: "Reservation",
  "فك حجز": "Reservation release",
  جه: "Inbound",
  طلع: "Outbound",
  اتساوى: "Adjustment",
};

export function ProductStockCardView({
  filters,
  stores,
  warehouses,
  products,
  report,
  canPrint,
  canExcel,
  canPdf,
}: ProductStockCardViewProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/product-card${printQs ? `?${printQs}` : ""}`;
  const salesProductQs = report
    ? reportFiltersToSearchParams({
        ...filters,
        productId: report.product.id,
        page: 1,
      })
    : "";
  const salesProductHref = report
    ? salesProductQs
      ? `/reports/sales/product?${salesProductQs}`
      : `/reports/sales/product?productId=${report.product.id}`
    : null;

  const apply = (next: Partial<ReportFilters>) => {
    const qs = reportFiltersToSearchParams({ ...filters, ...next, page: 1 });
    router.push(qs ? `/reports/product-card?${qs}` : "/reports/product-card");
  };

  const columns: ColumnDef<ProductStockCardLine>[] = [
    {
      header: t("Date"),
      id: "at",
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums text-sm">
          {formatDateTime(row.original.at)}
        </span>
      ),
    },
    {
      header: t("Type"),
      id: "type",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {language === "en"
              ? stockCardLabelsEn[row.original.movementTypeLabel] ?? row.original.movementTypeLabel
              : t(row.original.movementTypeLabel)}
          </p>
          <p className="text-xs text-muted-foreground">
            {language === "en"
              ? stockCardLabelsEn[row.original.bucketLabel] ?? row.original.bucketLabel
              : t(row.original.bucketLabel)}
          </p>
        </div>
      ),
    },
    {
      header: t("Inbound"),
      id: "in",
      cell: ({ row }) =>
        row.original.inQty > 0 ? (
          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatQty(row.original.inQty)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: t("Outbound"),
      id: "out",
      cell: ({ row }) =>
        row.original.outQty > 0 ? (
          <span className="tabular-nums text-red-700 dark:text-red-400">
            {formatQty(row.original.outQty)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: t("Adjustment"),
      id: "eq",
      cell: ({ row }) =>
        row.original.equalizeQty !== 0 ? (
          <span
            className={cn(
              "tabular-nums",
              row.original.equalizeQty > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-amber-800 dark:text-amber-300"
            )}
          >
            {row.original.equalizeQty > 0 ? "+" : ""}
            {formatQty(row.original.equalizeQty)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: t("Balance"),
      id: "balance",
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {formatQty(row.original.balance)}
        </span>
      ),
    },
    {
      header: t("Warehouse / reason"),
      id: "meta",
      cell: ({ row }) => (
        <div className="max-w-[14rem]">
          <p className="text-sm">{row.original.warehouseName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.reason || "—"}
          </p>
        </div>
      ),
    },
  ];

  const unitSuffix = report ? ` ${t(report.product.unitLabel)}` : "";

  return (
    <ReportPage
      title="Product Card"
      description={t("Opening balance, inbound, outbound, adjustments, and available stock for the selected period.")}
      actions={
        report ? (
          <div className="flex flex-wrap items-center gap-[var(--mds-space-2)] print:hidden">
            <CompactAction
              label="Product sales"
              icon={BarChart3}
              href={salesProductHref!}
            />
            <ExportButtonGroup
              printHref={canPrint ? printHref : undefined}
              canPrint={canPrint}
              canExcel={canExcel}
              canPdf={canPdf}
              pending={pending}
              onExportExcel={() => {
                startTransition(async () => {
                  try {
                    const result = await exportProductStockCardExcel(
                      Object.fromEntries(
                        Object.entries(filters).map(([k, v]) => [
                          k,
                          v === undefined ? undefined : String(v),
                        ])
                      ) as Record<string, string>
                    );
                    downloadBase64Excel(result.base64, result.filename);
                    toast.success("تم تصدير Excel");
                  } catch {
                    toast.error("فشل التصدير");
                  }
                });
              }}
            />
          </div>
        ) : undefined
      }
      filters={
        <div className="grid w-full grid-cols-2 gap-[var(--mds-space-3)] sm:gap-[var(--mds-space-4)] lg:grid-cols-[auto_auto_minmax(13rem,1fr)_auto] lg:items-end">
          <DateRangeFilter
            className="col-span-2 lg:col-span-2"
            value={{ from: filters.from ?? "", to: filters.to ?? "" }}
            onChange={(range) =>
              apply({
                from: range.from || undefined,
                to: range.to || undefined,
                days: undefined,
              })
            }
          />

          <div className="min-w-0 space-y-[var(--mds-space-1)]">
            <Label>{t("Product")}</Label>
            <Select
              value={filters.productId ?? "__unset"}
              onValueChange={(v) =>
                apply({ productId: !v || v === "__unset" ? undefined : v })
              }
            >
              <SelectTrigger className="min-h-11 w-full rounded-[var(--mds-radius-md)] sm:min-h-9 lg:w-[220px]">
                <SelectValue placeholder={t("Select a product…")}>
                  {(value) =>
                    !value || value === "__unset"
                      ? t("Select a product…")
                      : selectLabelById(products, value, (p) => p.name)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset" label={t("Select a product…")}>
                  {t("Select a product…")}
                </SelectItem>
                {products.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    {t("No tracked products")}
                  </SelectItem>
                ) : (
                  products.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      label={p.sku ? `${p.name} · ${p.sku}` : p.name}
                    >
                      {p.name}
                      {p.sku ? ` · ${p.sku}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {stores.length > 1 ? (
            <div className="space-y-[var(--mds-space-1)]">
              <Label>{t("Store")}</Label>
              <Select
                value={filters.storeId ?? "all"}
                onValueChange={(v) =>
                  apply({
                    storeId: !v || v === "all" ? undefined : v,
                    warehouseId: undefined,
                  })
                }
              >
                <SelectTrigger className="min-h-11 w-full rounded-[var(--mds-radius-md)] sm:min-h-9 lg:w-[160px]">
                  <SelectValue>
                    {(value) =>
                      !value || value === "all"
                        ? t("All stores")
                        : selectLabelById(stores, value, (s) => s.name)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" label={t("All stores")}>
                    {t("All stores")}
                  </SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id} label={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-[var(--mds-space-1)]">
            <Label>{t("Warehouse")}</Label>
            <Select
              value={filters.warehouseId ?? "all"}
              onValueChange={(v) =>
                apply({ warehouseId: !v || v === "all" ? undefined : v })
              }
            >
              <SelectTrigger className="min-h-11 w-full rounded-[var(--mds-radius-md)] sm:min-h-9 lg:w-[160px]">
                <SelectValue>
                  {(value) =>
                    value === "all"
                      ? t("All warehouses")
                      : selectLabelById(warehouses, value, (w) => w.name)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label={t("All warehouses")}>
                  {t("All warehouses")}
                </SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id} label={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {!filters.productId || !report ? (
        <EmptyStateBlock
          title={t("Select a product to view its card")}
          description={t("Choose a product and period to see opening balance, inbound, outbound, adjustments, and available stock.")}
        />
      ) : (
        <>
          <div className="rounded-[var(--mds-radius-lg)] border border-border bg-card px-[var(--mds-space-4)] py-[var(--mds-space-3)] text-sm">
            <p className="font-semibold">{report.product.name}</p>
            <p className="text-muted-foreground">
              {report.product.sku ? `SKU ${report.product.sku} · ` : ""}
              {t("Unit")}: {t(report.product.unitLabel)}
              {report.warehouseName ? ` · ${t("Warehouse")} ${report.warehouseName}` : ` · ${t("All warehouses")}`}
            </p>
          </div>

          <ReportKpiGrid
            columns={3}
            items={[
              {
                label: "Opening balance",
                value: `${formatQty(report.openingQty)}${unitSuffix}`,
                icon: <Package className="size-5" />,
              },
              {
                label: "Inbound",
                value: `${formatQty(report.totals.inQty)}${unitSuffix}`,
                icon: <ArrowDownToLine className="size-5" />,
                trend: "up",
              },
              {
                label: "Outbound",
                value: `${formatQty(report.totals.outQty)}${unitSuffix}`,
                icon: <ArrowUpFromLine className="size-5" />,
                trend: "down",
              },
              {
                label: "Adjustments",
                value: `${report.totals.equalizeQty > 0 ? "+" : ""}${formatQty(report.totals.equalizeQty)}${unitSuffix}`,
                icon: <Scale className="size-5" />,
              },
              {
                label: "Available at period end",
                value: `${formatQty(report.closingQty)}${unitSuffix}`,
                icon: <Warehouse className="size-5" />,
              },
              {
                label: "Current balance",
                value: `${formatQty(report.onHandQty)}${unitSuffix}`,
                icon: <Package className="size-5" />,
              },
            ]}
          />

          <ReportTable
            title={t("Product movement during the period")}
            columns={columns}
            data={report.lines}
            emptyMessage={t("No movements for this product during the selected period")}
          />
        </>
      )}
    </ReportPage>
  );
}
