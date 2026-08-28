import { getDb, callRpc, throwDbError } from "@/lib/repositories/client";
import type { StorefrontOrderStatus } from "../core/order-lifecycle";

export type StorefrontAdminOrder = {
  id: string;
  orderNumber: string;
  status: StorefrontOrderStatus;
  paymentStatus: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  fulfillmentType: "pickup" | "delivery";
  shippingAddress: Record<string, unknown>;
  grandTotal: number;
  currency: string;
  placedAt: string;
  notes: string;
  items: {
    id: string;
    name: string;
    variantName: string | null;
    quantity: number;
    lineTotal: number;
  }[];
};

type RawStorefrontOrder = {
  id: string;
  order_number: string;
  status: StorefrontOrderStatus;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  fulfillment_type: "pickup" | "delivery";
  shipping_address: Record<string, unknown> | null;
  grand_total: number | string;
  currency: string;
  placed_at: string;
  customer_notes: string | null;
  storefront_order_items: Array<{
    id: string;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    line_total: number | string;
  }> | null;
};

export async function listStorefrontOrders(
  storeId: string,
): Promise<StorefrontAdminOrder[]> {
  const db = await getDb();
  // Tables are introduced by the storefront migration; generated types follow deployment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("storefront_orders")
    .select(
      "id, order_number, status, payment_status, customer_name, customer_phone, customer_email, fulfillment_type, shipping_address, grand_total, currency, placed_at, customer_notes, storefront_order_items(id, product_name, variant_name, quantity, line_total)",
    )
    .eq("store_id", storeId)
    .order("placed_at", { ascending: false })
    .limit(200);
  const missing =
    error?.code === "PGRST205" || error?.message?.includes("schema cache");
  if (error && !missing) throwDbError(error, "listStorefrontOrders");
  return ((data ?? []) as RawStorefrontOrder[]).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email,
    fulfillmentType: order.fulfillment_type,
    shippingAddress: order.shipping_address ?? {},
    grandTotal: Number(order.grand_total),
    currency: order.currency,
    placedAt: order.placed_at,
    notes: order.customer_notes ?? "",
    items: (order.storefront_order_items ?? []).map((item) => ({
      id: item.id,
      name: item.product_name,
      variantName: item.variant_name,
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
    })),
  }));
}

export async function transitionStorefrontOrder(
  orderId: string,
  status: StorefrontOrderStatus,
  actorId: string,
) {
  const { data, error } = await callRpc(
    "transition_storefront_order_status_atomic",
    {
      p_order_id: orderId,
      p_status: status,
      p_actor_id: actorId,
    },
  );
  if (error) throwDbError(error, "transitionStorefrontOrder");
  return data;
}
