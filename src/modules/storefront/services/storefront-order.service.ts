import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeOnlineMenuSlug } from "@/lib/slugify";
import { roundMoney } from "@/lib/money";
import { normalizeEgyptPhone } from "@/lib/phone";
import { assertOnlinePublicRateLimit } from "@/modules/online-menu/lib/online-public-rate-limit";
import { evaluateOnlineOrderingAvailability } from "@/modules/online-menu/lib/online-ordering-hours";
import {
  parseOnlineFulfillment,
  resolveOnlineFulfillmentFee,
  type OnlineFulfillmentType,
} from "@/modules/online-menu/lib/online-fulfillment";
import {
  pricePublicCommerceLines,
  type OnlineOrderLineInput,
} from "@/modules/online-orders/services/online-order.service";
import { buildStorefrontRuntimeSettings } from "../core/runtime-settings";
import type { StorefrontOrderSummary } from "../core/types";

export type StorefrontOrderInput = {
  slug: string;
  token?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  address?: string | null;
  notes?: string;
  fulfillmentType: OnlineFulfillmentType;
  zoneId?: string | null;
  couponCode?: string | null;
  lines: OnlineOrderLineInput[];
};

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export async function submitStorefrontOrder(input: StorefrontOrderInput) {
  const slug = normalizeOnlineMenuSlug(input.slug);
  if (!slug) throw new Error("رابط المتجر غير صالح");
  await assertOnlinePublicRateLimit({
    action: "storefront_order_create",
    slug,
  });
  const admin = createAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id, org_id, name, timezone, settings")
    .eq("is_active", true)
    .filter("settings->>storefront_slug", "eq", slug)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("المتجر غير متاح");
  const settings = record(store.settings);
  if (settings.storefront_enabled !== true) throw new Error("المتجر غير متاح");
  if (settings.storefront_unlisted === true) {
    const expected =
      typeof settings.storefront_token === "string"
        ? settings.storefront_token
        : "";
    if (!expected || input.token !== expected)
      throw new Error("المتجر غير متاح");
  }
  const runtime = buildStorefrontRuntimeSettings(settings);
  const availability = evaluateOnlineOrderingAvailability({
    settings: runtime,
    storeTimezone: store.timezone,
  });
  if (!availability.canOrder) throw new Error(availability.messageAr);
  const fulfillment = resolveOnlineFulfillmentFee(
    parseOnlineFulfillment(runtime),
    {
      fulfillmentType: input.fulfillmentType,
      zoneId: input.zoneId,
      deliveryAddress: input.address,
    },
  );
  const priced = await pricePublicCommerceLines(
    store.org_id,
    store.id,
    input.lines,
    input.couponCode,
    "storefront",
  );
  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", store.org_id)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  const currency = organization?.currency ?? "EGP";
  const grandTotal = roundMoney(
    priced.subtotal - priced.promo_discount + fulfillment.deliveryFee,
  );
  const phone = normalizeEgyptPhone(input.customerPhone);
  if (phone.length < 5 || phone.length > 40)
    throw new Error("رقم الموبايل غير صالح");
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  let customerAuthUserId: string | null = null;
  if (authData.user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customerAccount } = await (admin as any)
      .from("storefront_customer_accounts")
      .select("auth_user_id")
      .eq("org_id", store.org_id)
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();
    customerAuthUserId = customerAccount?.auth_user_id ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (admin as any).rpc(
    "create_storefront_order_atomic",
    {
      p_order: {
        org_id: store.org_id,
        store_id: store.id,
        customer_name: input.customerName.trim(),
        customer_phone: phone,
        customer_email: input.customerEmail?.trim() || null,
        auth_user_id: customerAuthUserId,
        fulfillment_type: fulfillment.fulfillmentType,
        shipping_address:
          fulfillment.fulfillmentType === "delivery"
            ? {
                address: fulfillment.deliveryAddress,
                area: fulfillment.deliveryArea,
              }
            : {},
        delivery_zone_id: fulfillment.zoneId,
        delivery_area: fulfillment.deliveryArea,
        subtotal: priced.subtotal,
        discount: priced.promo_discount,
        shipping_total: fulfillment.deliveryFee,
        tax_total: 0,
        grand_total: grandTotal,
        currency,
        coupon_code: input.couponCode?.trim() || null,
        customer_notes: input.notes?.trim() || "",
      },
      p_items: priced.items.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        sku: item.sku,
        product_name: item.product_name,
        variant_name: item.variant_name,
        image_url: item.image_url,
        quantity: item.quantity,
        list_unit_price: item.list_unit_price,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        line_total: item.line_total,
        attributes_snapshot: item.attributes_snapshot,
      })),
    },
  );
  if (orderError || !order) {
    const message = orderError?.message ?? "";
    if (message.includes("Insufficient stock"))
      throw new Error("بعض المنتجات نفدت أو كميتها غير كافية");
    throw new Error(message || "تعذر إنشاء الطلب");
  }
  return {
    id: String(order.id),
    orderNumber: String(order.order_number),
    trackingToken: String(order.tracking_token),
    total: Number(order.grand_total),
    currency: String(order.currency),
    status: String(order.status),
    paymentStatus: String(order.payment_status),
  };
}

export async function getPublicStorefrontOrder(
  token: string,
  storeId: string,
): Promise<StorefrontOrderSummary | null> {
  if (!/^[a-f0-9]{48}$/i.test(token)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return null;
  const admin = createAdminClient();
  // New migration tables stay behind a narrow untyped boundary until DB types regenerate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error } = await (admin as any)
    .from("storefront_orders")
    .select(
      "id, order_number, status, payment_status, customer_name, grand_total, currency, placed_at",
    )
    .eq("tracking_token", token)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error || !order) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (admin as any)
    .from("storefront_order_items")
    .select("product_name, variant_name, quantity, line_total")
    .eq("order_id", order.id)
    .order("created_at");
  return {
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    customerName: order.customer_name,
    grandTotal: Number(order.grand_total),
    currency: order.currency,
    placedAt: order.placed_at,
    items: (items ?? []).map(
      (item: {
        product_name: string;
        variant_name: string | null;
        quantity: number;
        line_total: number;
      }) => ({
        name: item.variant_name
          ? `${item.product_name} (${item.variant_name})`
          : item.product_name,
        quantity: item.quantity,
        lineTotal: Number(item.line_total),
      }),
    ),
  };
}
