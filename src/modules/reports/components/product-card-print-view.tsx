"use client";

import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatDateTime } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import type { ProductStockCardReport } from "@/modules/reports/services/product-stock-card.service";
import { useTranslation } from "@/lib/i18n/use-translation";

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("ar-EG", {
    maximumFractionDigits: 4,
    numberingSystem: "latn",
  });
}

export interface ProductCardPrintData {
  report: ProductStockCardReport | null;
  context: ReportBranding & {
    generatedBy: string;
    generatedAt: string;
  };
}

export function ProductCardPrintView({ report: r, context }: ProductCardPrintData) {
  const { t, language } = useTranslation();
  if (!r) {
    return (
      <PrintableDocument
        branding={context}
        title="Product Stock Card"
        generatedBy={context.generatedBy}
        generatedAt={context.generatedAt}
      >
        <p className="text-sm text-muted-foreground">{t("Choose a product to print its stock card.")}</p>
      </PrintableDocument>
    );
  }

  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const fromLabel = new Date(r.fromIso).toLocaleDateString(locale);
  const toLabel = new Date(r.toIso).toLocaleDateString(locale);
  const unit = r.product.unitLabel;

  return (
    <PrintableDocument
      branding={context}
      title="Product Stock Card"
      dateRange={`${fromLabel} — ${toLabel}`}
      generatedBy={context.generatedBy}
      generatedAt={context.generatedAt}
      filterSummary={`${r.product.name}${r.product.sku ? ` · ${r.product.sku}` : ""}${
        r.warehouseName ? ` · ${r.warehouseName}` : ` · ${t("All warehouses")}`
      }`}
    >
      <table className="mb-6 w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-2 font-medium">{t("Opening balance")}</td>
            <td className="py-2 text-end tabular-nums">
              {formatQty(r.openingQty)} {unit}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">{t("Inbound")}</td>
            <td className="py-2 text-end tabular-nums">
              {formatQty(r.totals.inQty)} {unit}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">{t("Outbound")}</td>
            <td className="py-2 text-end tabular-nums">
              {formatQty(r.totals.outQty)} {unit}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">{t("Adjustments")}</td>
            <td className="py-2 text-end tabular-nums">
              {r.totals.equalizeQty > 0 ? "+" : ""}
              {formatQty(r.totals.equalizeQty)} {unit}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">{t("Closing stock")}</td>
            <td className="py-2 text-end font-semibold tabular-nums">
              {formatQty(r.closingQty)} {unit}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">{t("Date")}</th>
            <th className="py-2 text-start">{t("Type")}</th>
            <th className="py-2 text-end">{t("Inbound")}</th>
            <th className="py-2 text-end">{t("Outbound")}</th>
            <th className="py-2 text-end">{t("Adjustments")}</th>
            <th className="py-2 text-end">{t("Balance")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b bg-muted/20">
            <td className="py-2" colSpan={5}>
              {t("Opening balance")}
            </td>
            <td className="py-2 text-end font-medium tabular-nums">
              {formatQty(r.openingQty)}
            </td>
          </tr>
          {r.lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="py-2 whitespace-nowrap">{formatDateTime(line.at)}</td>
              <td className="py-2">{line.movementTypeLabel}</td>
              <td className="py-2 text-end tabular-nums">
                {line.inQty > 0 ? formatQty(line.inQty) : "—"}
              </td>
              <td className="py-2 text-end tabular-nums">
                {line.outQty > 0 ? formatQty(line.outQty) : "—"}
              </td>
              <td className="py-2 text-end tabular-nums">
                {line.equalizeQty !== 0
                  ? `${line.equalizeQty > 0 ? "+" : ""}${formatQty(line.equalizeQty)}`
                  : "—"}
              </td>
              <td className="py-2 text-end font-medium tabular-nums">
                {formatQty(line.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
