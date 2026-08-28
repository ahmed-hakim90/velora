import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StorefrontCustomerAccountSummary } from "../core/types";

export async function getStorefrontCustomerAccount(
  orgId: string,
): Promise<StorefrontCustomerAccountSummary | null> {
  const auth = await createClient();
  const { data } = await auth.auth.getUser();
  if (!data.user) return null;
  const admin = createAdminClient();
  // Account tables are introduced by the storefront migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error } = await (admin as any)
    .from("storefront_customer_accounts")
    .select("customer_id, display_name, email")
    .eq("org_id", orgId)
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (error || !account) return null;
  if (!account.customer_id)
    return {
      displayName: account.display_name || data.user.email || "عميل المتجر",
      email: account.email ?? data.user.email ?? null,
      customerId: null,
      addresses: [],
      orders: [],
    };
  const [{ data: addresses }, { data: orders }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("customer_addresses")
      .select("id, label, address_line, area, city, is_default")
      .eq("org_id", orgId)
      .eq("customer_id", account.customer_id)
      .order("is_default", { ascending: false })
      .order("last_used_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("storefront_orders")
      .select(
        "order_number, tracking_token, status, grand_total, currency, placed_at",
      )
      .eq("org_id", orgId)
      .eq("customer_id", account.customer_id)
      .order("placed_at", { ascending: false })
      .limit(100),
  ]);
  return {
    displayName: account.display_name || data.user.email || "عميل المتجر",
    email: account.email ?? data.user.email ?? null,
    customerId: account.customer_id,
    addresses: (addresses ?? []).map(
      (address: {
        id: string;
        label: string;
        address_line: string;
        area: string;
        city: string;
        is_default: boolean;
      }) => ({
        id: address.id,
        label: address.label,
        addressLine: address.address_line,
        area: address.area,
        city: address.city,
        isDefault: address.is_default,
      }),
    ),
    orders: (orders ?? []).map(
      (order: {
        order_number: string;
        tracking_token: string;
        status: string;
        grand_total: number | string;
        currency: string;
        placed_at: string;
      }) => ({
        orderNumber: order.order_number,
        trackingToken: order.tracking_token,
        status: order.status,
        grandTotal: Number(order.grand_total),
        currency: order.currency,
        placedAt: order.placed_at,
      }),
    ),
  };
}
