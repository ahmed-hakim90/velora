import type { PaymentMethod } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import { ReceiptDocumentView } from "@/modules/print-engine/components/receipt-document-view";
import { translateText, type AppLanguage } from "@/lib/i18n/translations";

export interface ReceiptPrintServerProps {
  documentLabel?: string;
  orderNumber: string;
  createdAt: string;
  items: Array<{ id: string; productName: string; quantity: number; unit_price: number; line_total: number }>;
  subtotal: number;
  discount: number;
  promoDiscount?: number;
  tax: number;
  total: number;
  paymentStatus?: "paid" | "unpaid" | "partial" | null;
  payments?: Array<{ id: string; method: PaymentMethod; amount: number }>;
  partyLabel?: string;
  partyName?: string | null;
  metaLines?: string[];
  isDraft?: boolean;
  branding: ReportBranding;
  language?: AppLanguage;
}

/** A4 receipt configuration rendered by the shared Velora print shell. */
export function ReceiptPrintServer({ documentLabel = "Payment receipt", orderNumber, createdAt, items, subtotal, discount, promoDiscount, tax, total, paymentStatus = null, payments = [], partyLabel = "Received from", partyName, metaLines = [], isDraft = false, branding, language = "ar" }: ReceiptPrintServerProps) {
  const tr = (text: string) => translateText(text, language);
  const summary = [
    { label: tr("Subtotal"), value: formatCurrency(subtotal, branding.currency) },
    ...(discount > 0 ? [{ label: tr(promoDiscount ? "Discount (includes promotion)" : "Discount"), value: `-${formatCurrency(discount, branding.currency)}` }] : []),
    ...(tax > 0 ? [{ label: tr("Tax"), value: formatCurrency(tax, branding.currency) }] : []),
    { label: tr("Total"), value: formatCurrency(total, branding.currency), strong: true },
  ];
  return <ReceiptDocumentView title={tr(documentLabel)} number={orderNumber} date={createdAt} amount={total} branding={branding} partyLabel={tr(partyLabel)} partyName={partyName} paymentStatus={paymentStatus} payments={payments} details={metaLines.map((value) => ({ label: tr("Details"), value }))} items={items.map((item) => ({ id: item.id, name: item.productName, quantity: item.quantity, unitPrice: item.unit_price, total: item.line_total }))} summary={summary} isDraft={isDraft} language={language} />;
}
