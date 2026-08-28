"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  CircleDollarSign,
  Receipt,
  ShoppingBag,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { OperationalCard } from "@/components/Velora/operational-card";
import { exportPnlReportExcel } from "@/modules/reports/actions/executive-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type { PnlLine } from "@/modules/reports/services/executive-analytics.service";
import type { ProfitReportDetail } from "@/modules/reports/services/profit-report.service";
import { useTranslation } from "@/lib/i18n/use-translation";

interface PnlReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  lines: PnlLine[];
  estimatedNet: number;
  profit: ProfitReportDetail;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function PnlReportView({
  filters,
  stores,
  currency,
  lines,
  estimatedNet,
  profit,
  canExcel,
}: PnlReportViewProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();

  const lineLabel = (key: string) => {
    const labels: Record<string, string> = {
      revenue: "Revenue",
      cogs: "COGS",
      grossProfit: "Gross profit",
      expenses: "Expenses",
      waste: "Waste",
      refunds: "Refunds",
      estimatedNet: "Estimated net profit",
    };
    return t(labels[key] ?? key);
  };

  return (
    <ReportPage
      title="Simplified income statement"
      description="Revenue, cost, gross profit, expenses, waste, refunds, and estimated net profit"
      actions={
        <ExportButtonGroup
          canPrint={false}
          canExcel={canExcel}
          canPdf={false}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportPnlReportExcel(
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
      filters={<ReportFiltersBar basePath="/reports/pnl" filters={filters} options={{ stores }} />}
    >
      <ReportKpiGrid
        columns={3}
        items={[
          {
            label: t("Revenue"),
            value: formatCurrency(profit.revenue, currency),
            icon: <ShoppingBag className="size-5" />,
          },
          {
            label: t("Gross profit"),
            value: formatCurrency(profit.grossProfit, currency),
            icon: <CircleDollarSign className="size-5" />,
          },
          {
            label: t("Estimated net profit"),
            value: formatCurrency(estimatedNet, currency),
            icon: <Wallet className="size-5" />,
          },
        ]}
      />

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-3">
        <OperationalCard title={t("Expenses")} className="lg:col-span-1">
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(profit.totalExpenses, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Receipt className="size-3.5" /> {t("From profit report")}
          </p>
        </OperationalCard>
        <OperationalCard title={t("Waste")}>
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(profit.wasteCost, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Trash2 className="size-3.5" /> {t("Estimated cost")}
          </p>
        </OperationalCard>
        <OperationalCard title={t("Refunds")}>
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(profit.refunds, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Undo2 className="size-3.5" /> {t("Cancelled / refunded")}
          </p>
        </OperationalCard>
      </div>

      <OperationalCard title={t("Income statement")}>
        <ul className="divide-y divide-border">
          {lines.map((line) => (
            <li
              key={line.key}
              className={cn(
                "flex items-center justify-between gap-4 py-3 text-sm",
                line.emphasis === "subtotal" && "font-medium bg-muted/40 px-2 rounded-md",
                line.emphasis === "total" && "font-semibold text-base pt-4"
              )}
            >
              <span>{lineLabel(line.key)}</span>
              <span
                className={cn(
                  "tabular-nums",
                  line.amount < 0 && "text-destructive"
                )}
              >
                {formatCurrency(line.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      </OperationalCard>
    </ReportPage>
  );
}
