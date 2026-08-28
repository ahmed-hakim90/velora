"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Percent, Receipt, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportTaxReportExcel } from "@/modules/reports/actions/tax-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { TaxDayRow, TaxReport } from "@/modules/reports/services/tax-report.service";
import type { Store } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

interface TaxReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  report: TaxReport;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function TaxReportView({
  filters,
  stores,
  currency,
  report,
  canPrint,
  canExcel,
  canPdf,
}: TaxReportViewProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/tax${printQs ? `?${printQs}` : ""}`;
  const ratePct = report.taxRate <= 1 ? report.taxRate * 100 : report.taxRate;

  const dayColumns: ColumnDef<TaxDayRow>[] = [
    { header: t("Day"), accessorKey: "date" },
    { header: t("Orders"), accessorKey: "orderCount" },
    {
      header: t("Taxable base"),
      id: "base",
      cell: ({ row }) => formatCurrency(row.original.taxableBase, currency),
    },
    {
      header: t("Tax"),
      id: "tax",
      cell: ({ row }) => formatCurrency(row.original.tax, currency),
    },
    {
      header: t("Total"),
      id: "total",
      cell: ({ row }) => formatCurrency(row.original.total, currency),
    },
  ];

  return (
    <ReportPage
      title="Tax report"
      description="Sales tax collected from completed orders, ready to export"
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
                const result = await exportTaxReportExcel(
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
      filters={
        <ReportFiltersBar
          basePath="/reports/tax"
          filters={filters}
          options={{ stores, showDaysPresets: true }}
        />
      }
    >
      <ReportKpiGrid
        items={[
          {
            label: t("Tax rate"),
            value: `${ratePct.toFixed(ratePct % 1 === 0 ? 0 : 2)}%${
              report.taxInclusive ? ` (${t("inclusive")})` : ` (${t("additional")})`
            }`,
            icon: <Percent className="size-5" />,
          },
          {
            label: t("Taxable base"),
            value: formatCurrency(report.summary.taxableBase, currency),
            icon: <Wallet className="size-5" />,
          },
          {
            label: t("Tax collected"),
            value: formatCurrency(report.summary.taxCollected, currency),
            icon: <Receipt className="size-5" />,
          },
          {
            label: t("Gross sales"),
            value: formatCurrency(report.summary.grossSales, currency),
            icon: <Wallet className="size-5" />,
          },
        ]}
      />

      {!report.taxEnabled && report.summary.taxCollected === 0 ? (
        <p className="rounded-[var(--mds-radius-md)] border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          {t("Tax is disabled or set to zero. The report shows saved tax values from completed orders.")}
        </p>
      ) : null}

      <ReportTable
        title={t("Tax by day")}
        columns={dayColumns}
        data={report.byDay}
        emptyMessage={t("No orders in this period")}
      />
    </ReportPage>
  );
}
