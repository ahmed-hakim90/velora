"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Layers, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportMarginsReportExcel } from "@/modules/reports/actions/executive-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type { ProductProfitRow } from "@/modules/reports/services/profit-report.service";
import type { CategoryMarginRow } from "@/modules/reports/services/executive-analytics.service";
import { useTranslation } from "@/lib/i18n/use-translation";

interface MarginsReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  products: ProductProfitRow[];
  categories: CategoryMarginRow[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function MarginsReportView({
  filters,
  stores,
  currency,
  products,
  categories,
  canExcel,
}: MarginsReportViewProps) {
  const { t, language } = useTranslation();
  const [pending, startTransition] = useTransition();
  const topProduct = products[0];
  const topCategory = categories[0];

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

  const categoryColumns: ColumnDef<CategoryMarginRow>[] = [
    { header: t("Category"), accessorKey: "categoryName" },
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

  return (
    <ReportPage
      title="Margin ranking"
      description="Highest product and category margins based on item cost"
      actions={
        <ExportButtonGroup
          canPrint={false}
          canExcel={canExcel}
          canPdf={false}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportMarginsReportExcel(
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
        <ReportFiltersBar basePath="/reports/margins" filters={filters} options={{ stores }} />
      }
    >
      <ReportKpiGrid
        columns={2}
        items={[
          {
            label: t("Highest product margin"),
            value: topProduct
              ? `${topProduct.name} (${topProduct.margin.toFixed(1)}%)`
              : "—",
            icon: <Percent className="size-5" />,
          },
          {
            label: t("Highest category margin"),
            value: topCategory
              ? `${topCategory.categoryName} (${topCategory.margin.toFixed(1)}%)`
              : "—",
            icon: <Layers className="size-5" />,
          },
        ]}
      />

      <ReportTable title={t("Products by margin")} columns={productColumns} data={products} />
      <ReportTable title={t("Categories by margin")} columns={categoryColumns} data={categories} />
    </ReportPage>
  );
}
