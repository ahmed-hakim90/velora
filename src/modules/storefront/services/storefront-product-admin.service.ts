import { getDb, throwDbError } from "@/lib/repositories/client";

export type StorefrontProductAdminItem = {
  id: string;
  name: string;
  sku: string;
  basePrice: number;
  imageUrl: string | null;
  published: boolean;
  title: string;
  description: string;
  specifications: { name: string; value: string }[];
  media: { url: string; altText: string }[];
  storefrontPrice: number | null;
  compareAtPrice: number | null;
};

export async function listStorefrontProductAdminItems(storeId: string): Promise<StorefrontProductAdminItem[]> {
  const db = await getDb();
  const { data: products, error } = await db.from("products")
    .select("id, name, sku, base_price, sale_price, image_url, show_on_storefront")
    .eq("is_active", true).eq("product_type", "finished").order("name");
  if (error) throwDbError(error, "listStorefrontProductAdminItems.products");
  const ids = (products ?? []).map((product) => product.id);
  if (!ids.length) return [];
  // Extension tables are introduced by the storefront foundation migration.
  const [{ data: contents, error: contentError }, { data: media, error: mediaError }, { data: prices, error: priceError }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).from("storefront_product_content").select("product_id, title, description, specifications").in("product_id", ids),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).from("storefront_product_media").select("product_id, url, alt_text, sort_order").in("product_id", ids).order("sort_order"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).from("storefront_product_prices").select("product_id, price, compare_at_price").eq("store_id", storeId).is("variant_id", null).in("product_id", ids),
  ]);
  const isMissingExtensionTable = (value: { code?: string; message?: string } | null) =>
    value?.code === "PGRST205" || value?.message?.includes("schema cache");
  if (contentError && !isMissingExtensionTable(contentError)) throwDbError(contentError, "listStorefrontProductAdminItems.content");
  if (mediaError && !isMissingExtensionTable(mediaError)) throwDbError(mediaError, "listStorefrontProductAdminItems.media");
  if (priceError && !isMissingExtensionTable(priceError)) throwDbError(priceError, "listStorefrontProductAdminItems.prices");
  const contentMap = new Map<string, Record<string, unknown>>((contents ?? []).map((row: Record<string, unknown>) => [String(row.product_id), row]));
  const priceMap = new Map<string, Record<string, unknown>>((prices ?? []).map((row: Record<string, unknown>) => [String(row.product_id), row]));
  const mediaMap = new Map<string, { url: string; altText: string }[]>();
  for (const row of media ?? []) mediaMap.set(row.product_id, [...(mediaMap.get(row.product_id) ?? []), { url: row.url, altText: row.alt_text }]);
  return (products ?? []).map((product) => {
    const content = contentMap.get(product.id);
    const price = priceMap.get(product.id);
    const specifications = Array.isArray(content?.specifications) ? content.specifications as { name: string; value: string }[] : [];
    return {
      id: product.id, name: product.name, sku: product.sku,
      basePrice: Number(product.sale_price ?? product.base_price), imageUrl: product.image_url,
      published: product.show_on_storefront === true,
      title: typeof content?.title === "string" ? content.title : "",
      description: typeof content?.description === "string" ? content.description : "",
      specifications, media: mediaMap.get(product.id) ?? [],
      storefrontPrice: price ? Number(price.price) : null,
      compareAtPrice: price?.compare_at_price == null ? null : Number(price.compare_at_price),
    };
  });
}
