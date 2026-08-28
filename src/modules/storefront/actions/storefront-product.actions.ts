"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({
  productId: z.uuid(),
  storeId: z.uuid(),
  published: z.boolean(),
  title: z.string().trim().max(160),
  description: z.string().trim().max(5000),
  specifications: z.array(z.object({ name: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(240) })).max(40),
  media: z.array(z.object({ url: z.url(), altText: z.string().trim().max(180) })).max(12),
  storefrontPrice: z.number().min(0).nullable(),
  compareAtPrice: z.number().min(0).nullable(),
}).superRefine((value, context) => {
  if (value.storefrontPrice != null && value.compareAtPrice != null && value.compareAtPrice < value.storefrontPrice) {
    context.addIssue({ code: "custom", path: ["compareAtPrice"], message: "السعر قبل الخصم يجب أن يساوي أو يتجاوز سعر المتجر" });
  }
});

export type StorefrontProductAdminInput = z.input<typeof inputSchema>;

export async function saveStorefrontProductAction(raw: StorefrontProductAdminInput) {
  const input = inputSchema.parse(raw);
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const admin = createAdminClient();
  const [{ data: product }, { data: store }] = await Promise.all([
    admin.from("products").select("id, org_id").eq("id", input.productId).eq("org_id", user.org_id).maybeSingle(),
    admin.from("stores").select("id, org_id").eq("id", input.storeId).eq("org_id", user.org_id).maybeSingle(),
  ]);
  if (!product || !store) throw new Error("المنتج أو الفرع غير متاح");
  const { error: productError } = await admin.from("products").update({ show_on_storefront: input.published }).eq("id", input.productId).eq("org_id", user.org_id);
  if (productError) throw new Error(productError.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extensionDb = admin as any;
  const { error: contentError } = await extensionDb.from("storefront_product_content").upsert({
    product_id: input.productId, org_id: user.org_id, title: input.title,
    description: input.description, specifications: input.specifications,
  }, { onConflict: "product_id" });
  if (contentError) throw new Error(contentError.message);
  const { error: deleteMediaError } = await extensionDb.from("storefront_product_media").delete().eq("product_id", input.productId);
  if (deleteMediaError) throw new Error(deleteMediaError.message);
  if (input.media.length) {
    const { error: mediaError } = await extensionDb.from("storefront_product_media").insert(input.media.map((media, index) => ({
      product_id: input.productId, org_id: user.org_id, url: media.url, alt_text: media.altText, sort_order: index,
    })));
    if (mediaError) throw new Error(mediaError.message);
  }
  await extensionDb.from("storefront_product_prices").delete().eq("store_id", input.storeId).eq("product_id", input.productId).is("variant_id", null);
  if (input.storefrontPrice != null) {
    const { error: priceError } = await extensionDb.from("storefront_product_prices").insert({
      org_id: user.org_id, store_id: input.storeId, product_id: input.productId,
      variant_id: null, price: input.storefrontPrice, compare_at_price: input.compareAtPrice,
    });
    if (priceError) throw new Error(priceError.message);
  }
  revalidatePath("/storefront");
  revalidatePath("/store", "layout");
  return { ok: true };
}
