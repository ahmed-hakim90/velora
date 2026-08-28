import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import { LocalizedText } from "@/components/Velora/localized-text";

export interface PurchaseInvoicePrintData {
  purchase: {
    invoice_number: string;
    created_at: string;
    supplierName: string;
    warehouseName: string;
    lines: Array<{
      id: string;
      product_id: string;
      quantity: number;
      unit_cost: number;
      line_total: number;
    }>;
    total: number;
  };
  productMap: Map<string, string>;
  branding: ReportBranding;
  userName: string;
}

export function PurchaseInvoicePrintView({
  purchase,
  productMap,
  branding,
  userName,
}: PurchaseInvoicePrintData) {
  return (
    <PrintableDocument
      branding={branding}
      title="Purchase invoice"
      subtitle={purchase.invoice_number}
      dateRange={formatDateTime(purchase.created_at)}
      generatedBy={userName}
      generatedAt={new Date().toISOString()}
    >
      <p className="mb-4 text-sm">
        <LocalizedText text="Supplier" />: {purchase.supplierName} · <LocalizedText text="Warehouse" />: {purchase.warehouseName}
      </p>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start"><LocalizedText text="Product" /></th>
            <th className="py-2 text-end"><LocalizedText text="Quantity" /></th>
            <th className="py-2 text-end"><LocalizedText text="Cost" /></th>
            <th className="py-2 text-end"><LocalizedText text="Total" /></th>
          </tr>
        </thead>
        <tbody>
          {purchase.lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="py-2">{productMap.get(line.product_id) ?? line.product_id}</td>
              <td className="py-2 text-end">{line.quantity}</td>
              <td className="py-2 text-end">
                {formatCurrency(line.unit_cost, branding.currency)}
              </td>
              <td className="py-2 text-end">
                {formatCurrency(line.line_total, branding.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-end text-base font-bold">
        <LocalizedText text="Total" />: {formatCurrency(purchase.total, branding.currency)}
      </p>
    </PrintableDocument>
  );
}
