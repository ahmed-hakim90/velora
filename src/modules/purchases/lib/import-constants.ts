/** Purchase import (containers / customs) — domain constants. */

export const PURCHASE_CONTAINER_STATUSES = [
  "planned",
  "shipped",
  "at_port",
  "inland",
  "received",
  "cancelled",
] as const;

export type PurchaseContainerStatus = (typeof PURCHASE_CONTAINER_STATUSES)[number];

export const PURCHASE_CONTAINER_STATUS_LABELS: Record<PurchaseContainerStatus, string> = {
  planned: "Planned",
  shipped: "Shipped",
  at_port: "At port",
  inland: "On the way to warehouse",
  received: "Received",
  cancelled: "Cancelled",
};

export const CUSTOMS_CERTIFICATE_STATUSES = ["open", "closed"] as const;
export type CustomsCertificateStatus = (typeof CUSTOMS_CERTIFICATE_STATUSES)[number];

export const CUSTOMS_CERTIFICATE_STATUS_LABELS: Record<CustomsCertificateStatus, string> = {
  open: "Open",
  closed: "Closed",
};

export const CUSTOMS_CERTIFICATE_COST_TYPES = [
  "customs",
  "port",
  "demurrage",
  "inland",
  "agent",
  "other",
] as const;

export type CustomsCertificateCostType = (typeof CUSTOMS_CERTIFICATE_COST_TYPES)[number];

export const CUSTOMS_CERTIFICATE_COST_TYPE_LABELS: Record<CustomsCertificateCostType, string> = {
  customs: "Customs",
  port: "Port fees",
  demurrage: "Demurrage",
  inland: "Inland transport",
  agent: "Customs agent",
  other: "Other",
};

export const IMPORT_DOCUMENT_CURRENCIES = ["USD", "EUR", "EGP"] as const;
export type ImportDocumentCurrency = (typeof IMPORT_DOCUMENT_CURRENCIES)[number];
