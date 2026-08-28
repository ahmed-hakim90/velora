export const STOREFRONT_ORDER_STATUSES = [
  "pending", "confirmed", "processing", "ready_to_ship", "shipped",
  "delivered", "cancelled", "returned", "refunded",
] as const;

export type StorefrontOrderStatus = (typeof STOREFRONT_ORDER_STATUSES)[number];

const transitions: Record<StorefrontOrderStatus, readonly StorefrontOrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: ["refunded"],
  refunded: [],
};

export function canTransitionStorefrontOrder(
  from: StorefrontOrderStatus,
  to: StorefrontOrderStatus,
): boolean {
  return from === to || transitions[from].includes(to);
}

export const STOREFRONT_ORDER_STATUS_LABELS_AR: Record<StorefrontOrderStatus, string> = {
  pending: "قيد المراجعة",
  confirmed: "تم التأكيد",
  processing: "جاري التجهيز",
  ready_to_ship: "جاهز للشحن",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  returned: "مرتجع",
  refunded: "تم رد المبلغ",
};
