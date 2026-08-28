export type PrintDocumentFamily = "commercial" | "receipt" | "statement" | "inventory";

export type PrintDocumentConfig = {
  family: PrintDocumentFamily;
  defaultVariant: "executive" | "minimal" | "corporate";
  showItems: boolean;
  showAmountHero?: boolean;
  showBalanceSummary?: boolean;
  partyLabel?: string;
  amountLabel?: string;
  signatureLabels?: string[];
};

/** Presentation-only configuration. Values and calculations stay in domain services. */
export const PRINT_DOCUMENT_CONFIGS: Record<string, PrintDocumentConfig> = {
  invoice: { family: "commercial", defaultVariant: "executive", showItems: true, partyLabel: "فاتورة إلى" },
  tax_invoice: { family: "commercial", defaultVariant: "executive", showItems: true, partyLabel: "فاتورة إلى" },
  quotation: { family: "commercial", defaultVariant: "corporate", showItems: true, partyLabel: "عرض إلى" },
  sales_order: { family: "commercial", defaultVariant: "executive", showItems: true, partyLabel: "العميل" },
  delivery_note: { family: "commercial", defaultVariant: "minimal", showItems: true, partyLabel: "التسليم إلى" },
  purchase_order: { family: "commercial", defaultVariant: "corporate", showItems: true, partyLabel: "المورد" },
  purchase_invoice: { family: "commercial", defaultVariant: "executive", showItems: true, partyLabel: "المورد" },
  credit_note: { family: "commercial", defaultVariant: "executive", showItems: true, partyLabel: "العميل" },
  payment_receipt: { family: "receipt", defaultVariant: "executive", showItems: false, showAmountHero: true, showBalanceSummary: true, partyLabel: "المستلم من", amountLabel: "المبلغ المستلم", signatureLabels: ["إعداد", "العميل / الدافع"] },
  cash_receipt: { family: "receipt", defaultVariant: "executive", showItems: false, showAmountHero: true, showBalanceSummary: true, partyLabel: "المستلم من", amountLabel: "المبلغ المستلم" },
  supplier_payment_receipt: { family: "receipt", defaultVariant: "executive", showItems: false, showAmountHero: true, showBalanceSummary: true, partyLabel: "المدفوع إلى", amountLabel: "المبلغ المدفوع" },
  receipt_voucher: { family: "receipt", defaultVariant: "minimal", showItems: false, showAmountHero: true, partyLabel: "المستلم من", amountLabel: "المبلغ" },
  refund_receipt: { family: "receipt", defaultVariant: "executive", showItems: false, showAmountHero: true, showBalanceSummary: false, partyLabel: "المسترد له", amountLabel: "المبلغ المسترد" },
  customer_statement: { family: "statement", defaultVariant: "minimal", showItems: true, partyLabel: "العميل" },
  supplier_statement: { family: "statement", defaultVariant: "minimal", showItems: true, partyLabel: "المورد" },
  stock_transfer: { family: "inventory", defaultVariant: "minimal", showItems: true },
  inventory_adjustment: { family: "inventory", defaultVariant: "minimal", showItems: true },
};
