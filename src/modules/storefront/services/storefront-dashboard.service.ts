import { getDb } from "@/lib/repositories/client";

export type StorefrontDashboardSummary = {
  publishedProducts: number;
  totalProducts: number;
  pendingOrders: number;
  totalOrders: number;
  revenue: number;
  currency: string;
  databaseReady: boolean;
};

export async function getStorefrontDashboardSummary(
  storeId: string,
  currency: string,
): Promise<StorefrontDashboardSummary> {
  const db = await getDb();
  const [{ count: totalProducts }, { count: publishedProducts }] =
    await Promise.all([
      db
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("product_type", "finished"),
      db
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("product_type", "finished")
        .eq("show_on_storefront", true),
    ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders, error } = await (db as any)
    .from("storefront_orders")
    .select("status, grand_total")
    .eq("store_id", storeId)
    .limit(1000);
  const missing =
    error?.code === "PGRST205" || error?.message?.includes("schema cache");
  if (error && !missing) throw new Error(error.message);
  const rows = orders ?? [];
  return {
    totalProducts: totalProducts ?? 0,
    publishedProducts: publishedProducts ?? 0,
    totalOrders: rows.length,
    pendingOrders: rows.filter((order: { status: string }) =>
      ["pending", "confirmed", "processing", "ready_to_ship"].includes(
        order.status,
      ),
    ).length,
    revenue: rows
      .filter((order: { status: string }) => order.status === "delivered")
      .reduce(
        (sum: number, order: { grand_total: number | string }) =>
          sum + Number(order.grand_total),
        0,
      ),
    currency,
    databaseReady: !missing,
  };
}
