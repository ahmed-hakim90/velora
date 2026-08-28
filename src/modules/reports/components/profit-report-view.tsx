"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CircleDollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  Trash2,
  Receipt,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { OperationalCard } from "@/components/Velora/operational-card";
import { exportProfitReportExcel } from "@/modules/reports/actions/profit-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type {
  DayProfitRow,
  InvoiceProfitRow,
  ProductProfitRow,
  PurchaseInvoiceProfitRow,
} from "@/modules/reports/services/profit-report.service";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ProfitReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  profit: Awaited<
    ReturnType<typeof import("@/modules/reports/services/profit-report.service").getProfitReport>
  >;
  rankings: Awaited<
    ReturnType<
      typeof import("@/modules/reports/services/profit-report.service").productRankingsFromReport
    >
  >;
  outstanding: { id: string; name: string; account_balance: number }[];
  supplierBalances: { id: string; name: string; balanceDue: number }[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function ProfitReportView({
  filters,
  stores,
  currency,
  profit,
  rankings,
  outstanding,
  supplierBalances,
  canPrint,
  canExcel,
  canPdf,
}: ProfitReportViewProps) {
  const { t, language } = useTranslation();
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/profit${printQs ? `?${printQs}` : ""}`;

  const invoiceColumns: ColumnDef<InvoiceProfitRow>[] = [
    { header: t("Sales invoice"), accessorKey: "orderNumber" },
    {
      id: "createdAt",
      header: t("Date"),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(language === "ar" ? "ar-EG" : "en-US"),
    },
    {
      id: "revenue",
      header: t("Sales"),
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "cost",
      header: t("Cost"),
      cell: ({ row }) => formatCurrency(row.original.cost, currency),
    },
    {
      id: "profit",
      header: t("Expected profit"),
      cell: ({ row }) => formatCurrency(row.original.profit, currency),
    },
    {
      id: "margin",
      header: t("Margin %"),
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  const purchaseInvoiceColumns: ColumnDef<PurchaseInvoiceProfitRow>[] = [
    { header: t("Purchase invoice"), accessorKey: "invoiceNumber" },
    {
      id: "receivedAt",
      header: t("Received date"),
      cell: ({ row }) => new Date(row.original.receivedAt).toLocaleString(language === "ar" ? "ar-EG" : "en-US"),
    },
    {
      id: "purchaseCost",
      header: t("Purchase cost"),
      cell: ({ row }) => formatCurrency(row.original.purchaseCost, currency),
    },
    {
      id: "expectedSellValue",
      header: t("Expected sale value"),
      cell: ({ row }) => formatCurrency(row.original.expectedSellValue, currency),
    },
    {
      id: "expectedProfit",
      header: t("Expected profit"),
      cell: ({ row }) => formatCurrency(row.original.expectedProfit, currency),
    },
    {
      id: "margin",
      header: t("Margin %"),
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  const dayColumns: ColumnDef<DayProfitRow>[] = [
    { header: t("Day"), accessorKey: "date" },
    { header: t("Invoices"), accessorKey: "orders" },
    {
      id: "revenue",
      header: t("Sales"),
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "cost",
      header: t("Cost"),
      cell: ({ row }) => formatCurrency(row.original.cost, currency),
    },
    {
      id: "profit",
      header: t("Profit"),
      cell: ({ row }) => formatCurrency(row.original.profit, currency),
    },
    {
      id: "margin",
      header: t("Margin %"),
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  const productColumns: ColumnDef<ProductProfitRow>[] = [
    { header: t("Product"), accessorKey: "name" },
    {
      id: "qty",
      header: t("Quantity"),
      cell: ({ row }) => row.original.quantitySold.toLocaleString(language === "ar" ? "ar-EG" : "en-US"),
    },
    {
      id: "revenue",
      header: t("Sales"),
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "cost",
      header: t("Cost"),
      cell: ({ row }) => formatCurrency(row.original.cost, currency),
    },
    {
      id: "profit",
      header: t("Profit"),
      cell: ({ row }) => formatCurrency(row.original.profit, currency),
    },
    {
      id: "margin",
      header: t("Margin %"),
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  const chartData = profit.byDay.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <ReportPage
      title="Profit report"
      description="Profit by invoice, daily and product totals, and expected inventory profit"
      actions={
        <ExportButtonGroup
          printHref={canPrint ? printHref : undefined}
          canPrint={canPrint}
          canExcel={canExcel}
          canPdf={canPdf}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportProfitReportExcel(
                  Object.fromEntries(
                    Object.entries(filters).map(([k, v]) => [
                      k,
                      v === undefined ? undefined : String(v),
                    ])
                  ) as Record<string, string>
                );
                downloadBase64Excel(result.base64, result.filename);
                toast.success(t("Excel exported"));
              } catch {
                toast.error(t("Export failed"));
              }
            });
          }}
        />
      }
      filters={<ReportFiltersBar basePath="/reports/profit" filters={filters} options={{ stores }} />}
    >
      <ReportKpiGrid
        columns={4}
        items={[
          {
            label: t("Revenue"),
            value: formatCurrency(profit.revenue, currency),
            icon: <TrendingUp className="size-5" />,
          },
          {
            label: t("COGS"),
            value: formatCurrency(profit.cogs, currency),
            icon: <TrendingDown className="size-5" />,
          },
          {
            label: t("Gross profit"),
            value: formatCurrency(profit.grossProfit, currency),
            icon: <CircleDollarSign className="size-5" />,
          },
          {
            label: t("Net profit"),
            value: formatCurrency(profit.estimatedNetProfit, currency),
            icon: <CircleDollarSign className="size-5" />,
          },
          { label: t("Expenses"), value: formatCurrency(profit.totalExpenses, currency) },
          {
            label: t("Waste cost"),
            value: formatCurrency(profit.wasteCost, currency),
            icon: <Trash2 className="size-5" />,
          },
          {
            label: t("Average invoice profit"),
            value: formatCurrency(profit.avgOrderProfit, currency),
            icon: <Receipt className="size-5" />,
          },
          {
            label: t("Expected inventory profit"),
            value: formatCurrency(profit.inventory.inventoryExpectedProfit, currency),
            icon: <Package className="size-5" />,
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-[var(--mds-space-3)] sm:gap-[var(--mds-space-4)] lg:grid-cols-3">
        <OperationalCard title={t("Inventory — sale value")}>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(profit.inventory.inventorySellValue, currency)}
          </p>
        </OperationalCard>
        <OperationalCard title={t("Inventory — purchase cost")}>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(profit.inventory.inventoryCostValue, currency)}
          </p>
        </OperationalCard>
        <OperationalCard title={t("Inventory — expected profit")}>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(profit.inventory.inventoryExpectedProfit, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("Sale value minus purchase cost for current quantities")}</p>
        </OperationalCard>
      </div>

      {chartData.length > 0 ? (
        <ReportChartSection title={t("Profit by day")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={56} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
              />
              <Bar dataKey="profit" name={t("Profit")} fill="var(--mds-color-action-primary)" radius={4} />
              <Bar dataKey="revenue" name={t("Sales")} fill="var(--mds-color-harbor-300)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-2">
        <OperationalCard title={t("Most profitable products")}>
          <ul className="space-y-2 text-sm">
            {rankings.highestProfit.map((p) => (
              <li key={p.productId} className="flex justify-between gap-2">
                <span className="min-w-0 truncate" title={p.name}>
                  {p.name}
                </span>
                <span className="shrink-0 tabular-nums font-medium">
                  {formatCurrency(p.profit, currency)}
                  <span className="text-muted-foreground"> ({p.margin.toFixed(0)}%)</span>
                </span>
              </li>
            ))}
            {rankings.highestProfit.length === 0 ? (
              <p className="text-muted-foreground">{t("No sales in this period")}</p>
            ) : null}
          </ul>
        </OperationalCard>
        <OperationalCard title={t("Top-selling products and profit")}>
          <ul className="space-y-2 text-sm">
            {rankings.highestSelling.map((p) => (
              <li key={p.productId} className="flex justify-between gap-2">
                <span className="min-w-0 truncate" title={p.name}>
                  {p.name}
                </span>
                <span className="shrink-0 text-end tabular-nums">
                  <span className="font-medium">{formatCurrency(p.revenue, currency)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("Profit")} {formatCurrency(p.profit, currency)}
                  </span>
                </span>
              </li>
            ))}
            {rankings.highestSelling.length === 0 ? (
              <p className="text-muted-foreground">{t("No sales in this period")}</p>
            ) : null}
          </ul>
        </OperationalCard>
      </div>

      <ReportTable
        title={t("Expected profit by sales invoice")}
        columns={invoiceColumns}
        data={profit.invoices}
        emptyMessage={t("No completed sales invoices in this period")}
      />

      <ReportTable
        title={t("Expected profit by purchase invoice")}
        columns={purchaseInvoiceColumns}
        data={profit.purchaseInvoices}
        emptyMessage={t("No received purchase invoices in this period")}
      />

      <ReportTable
        title={t("Totals by day")}
        columns={dayColumns}
        data={[...profit.byDay].reverse()}
        emptyMessage={t("No days with sales in this period")}
      />

      <ReportTable
        title={t("Product totals (sales, cost, and profit)")}
        columns={productColumns}
        data={profit.products}
        emptyMessage={t("No sold products in this period")}
      />

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-2">
        <OperationalCard title={t("Customer credit balances")}>
          <ul className="space-y-2 text-sm">
            {outstanding.slice(0, 8).map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate" title={c.name}>
                  {c.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatCurrency(c.account_balance, currency)}
                </span>
              </li>
            ))}
            {outstanding.length === 0 ? (
              <p className="text-muted-foreground">{t("No balances")}</p>
            ) : null}
          </ul>
        </OperationalCard>
        <OperationalCard title={t("Supplier balances")}>
          <ul className="space-y-2 text-sm">
            {supplierBalances.slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate" title={s.name}>
                  {s.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatCurrency(s.balanceDue, currency)}
                </span>
              </li>
            ))}
            {supplierBalances.length === 0 ? (
              <p className="text-muted-foreground">{t("No balances")}</p>
            ) : null}
          </ul>
        </OperationalCard>
        <OperationalCard title={t("Expenses by cost center")}>
          <ul className="space-y-2 text-sm">
            {profit.expensesByCostCenter.slice(0, 8).map((c) => (
              <li key={c.name} className="flex justify-between gap-2">
                <span className="min-w-0 truncate" title={c.name}>
                  {c.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatCurrency(c.amount, currency)}
                </span>
              </li>
            ))}
            {profit.expensesByCostCenter.length === 0 ? (
              <p className="text-muted-foreground">{t("No expenses")}</p>
            ) : null}
          </ul>
        </OperationalCard>
      </div>
    </ReportPage>
  );
}
