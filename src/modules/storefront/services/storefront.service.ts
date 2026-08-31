import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { normalizeOnlineMenuSlug, slugifyBranchName } from "@/lib/slugify";
import { evaluateOnlineOrderingAvailability } from "@/modules/online-menu/lib/online-ordering-hours";
import { parseOnlineFulfillment } from "@/modules/online-menu/lib/online-fulfillment";
import { normalizeStorefrontConfig } from "../core/config";
import type { StorefrontAttributeValue, StorefrontData } from "../core/types";
import { buildStorefrontRuntimeSettings } from "../core/runtime-settings";
import { assertOnlinePublicRateLimit } from "@/modules/online-menu/lib/online-public-rate-limit";
import { isStorefrontPreviewValid } from "../core/preview";
import { canActivateStorefrontTheme } from "../core/theme-commerce";
import {
  getOrgStorefrontThemeEntitlements,
  getStorefrontThemeCatalog,
} from "@/modules/platform/services/platform-storefront-themes.service";

type JsonRecord = Record<string, unknown>;

function record(value: Json | null | undefined): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function parseAttributeValue(value: unknown): StorefrontAttributeValue | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string"))
    return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as { min?: unknown; max?: unknown };
    if (
      typeof candidate.min === "number" &&
      typeof candidate.max === "number"
    ) {
      return { min: candidate.min, max: candidate.max };
    }
  }
  return null;
}

export type StorefrontLoadOptions = {
  token?: string | null;
  previewToken?: string | null;
  /** Metadata/internal duplicate reads must not consume another public event. */
  skipRateLimit?: boolean;
};

export async function getStorefrontBySlug(
  rawSlug: string,
  options: StorefrontLoadOptions = {},
): Promise<StorefrontData | null> {
  const slug = normalizeOnlineMenuSlug(rawSlug);
  if (!slug) return null;
  const admin = createAdminClient();
  const { data: store, error } = await admin
    .from("stores")
    .select("id, org_id, name, address, phone, timezone, settings")
    .eq("is_active", true)
    .filter("settings->>storefront_slug", "eq", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!store) return null;

  const settings = record(store.settings);
  if (settings.storefront_enabled !== true) return null;
  if (settings.storefront_unlisted === true) {
    const expected =
      typeof settings.storefront_token === "string"
        ? settings.storefront_token
        : "";
    if (!expected || options.token !== expected) return null;
  }
  const published = normalizeStorefrontConfig(settings.storefront_published);
  const preview = normalizeStorefrontConfig(settings.storefront_draft);
  const usePreview = isStorefrontPreviewValid({
    providedToken: options.previewToken,
    storedToken: settings.storefront_preview_token,
    expiresAt: settings.storefront_preview_expires_at,
  });
  // A verified preview is an editor capability and must not consume the public
  // visitor bucket during rapid design refreshes. Invalid preview attempts stay
  // rate-limited like every other public read.
  if (!options.skipRateLimit && !usePreview) {
    await assertOnlinePublicRateLimit({ action: "storefront_read", slug });
  }
  if (options.previewToken && !usePreview) return null;
  if (usePreview) {
    const [catalog, entitlements] = await Promise.all([
      getStorefrontThemeCatalog(),
      getOrgStorefrontThemeEntitlements(store.org_id),
    ]);
    if (!canActivateStorefrontTheme(preview.theme, catalog, entitlements))
      return null;
  }
  const config = usePreview ? preview : published;

  const isolatedRuntimeSettings = buildStorefrontRuntimeSettings(settings);
  const availability = evaluateOnlineOrderingAvailability({
    settings: isolatedRuntimeSettings,
    storeTimezone: store.timezone ?? "Africa/Cairo",
  });
  const fulfillment = parseOnlineFulfillment(isolatedRuntimeSettings);

  const [
    { data: organization, error: orgError },
    { data: categories, error: categoryError },
    { data: productRows, error: productError },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, currency, logo_url")
      .eq("id", store.org_id)
      .maybeSingle(),
    admin
      .from("categories")
      .select("id, name, sort_order, color, icon")
      .eq("org_id", store.org_id)
      .order("sort_order"),
    admin
      .from("products")
      .select(
        "id, org_id, category_id, name, description, image_url, base_price, sale_price, is_popular, show_on_storefront",
      )
      .eq("org_id", store.org_id)
      .eq("is_active", true)
      .eq("product_type", "finished")
      .eq("inventory_product_type", "finished_product")
      .eq("show_on_storefront", true)
      .order("is_popular", { ascending: false })
      .order("name"),
  ]);
  if (orgError) throw new Error(orgError.message);
  if (categoryError) throw new Error(categoryError.message);
  if (productError) throw new Error(productError.message);
  if (!organization) return null;
  const scopedProducts = productRows ?? [];
  const productIds = scopedProducts.map((item) => item.id);
  const [
    { data: variantRows, error: variantError },
    contentResult,
    mediaResult,
    priceResult,
  ] = productIds.length
    ? await Promise.all([
        admin
          .from("product_variants")
          .select("id, product_id, name, price, price_delta, is_active")
          .in("product_id", productIds)
          .eq("is_active", true)
          .order("name"),
        // Storefront extension tables are introduced by the storefront migration.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin as any)
          .from("storefront_product_content")
          .select("product_id, title, description, specifications")
          .in("product_id", productIds),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin as any)
          .from("storefront_product_media")
          .select("id, product_id, url, alt_text, sort_order")
          .in("product_id", productIds)
          .order("sort_order"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin as any)
          .from("storefront_product_prices")
          .select(
            "product_id, variant_id, store_id, price, compare_at_price, starts_at, ends_at",
          )
          .in("product_id", productIds)
          .eq("is_active", true)
          .or(`store_id.is.null,store_id.eq.${store.id}`),
      ])
    : [{ data: [], error: null }, { data: [] }, { data: [] }, { data: [] }];
  if (variantError) throw new Error(variantError.message);
  const contentByProduct = new Map<string, Record<string, unknown>>(
    (contentResult.data ?? []).map((row: Record<string, unknown>) => [
      String(row.product_id),
      row,
    ]),
  );
  const mediaByProduct = new Map<
    string,
    { id: string; url: string; altText: string }[]
  >();
  for (const row of mediaResult.data ?? []) {
    const list = mediaByProduct.get(row.product_id) ?? [];
    list.push({ id: row.id, url: row.url, altText: row.alt_text });
    mediaByProduct.set(row.product_id, list);
  }
  const now = Date.now();
  const activePrices = (priceResult.data ?? []).filter(
    (row: { starts_at: string | null; ends_at: string | null }) =>
      (!row.starts_at || Date.parse(row.starts_at) <= now) &&
      (!row.ends_at || Date.parse(row.ends_at) > now),
  );
  const priceByScope = new Map<
    string,
    { price: number; compare_at_price: number | null }
  >();
  for (const row of activePrices.sort(
    (a: { store_id: string | null }, b: { store_id: string | null }) =>
      Number(Boolean(a.store_id)) - Number(Boolean(b.store_id)),
  )) {
    priceByScope.set(`${row.product_id}:${row.variant_id ?? ""}`, row);
  }
  const productById = new Map(
    scopedProducts.map((product) => [product.id, product]),
  );
  const variantsByProduct = new Map<
    string,
    { id: string; name: string; price: number; available: boolean }[]
  >();
  for (const variant of variantRows ?? []) {
    const product = productById.get(variant.product_id);
    if (!product) continue;
    const baseOverride = priceByScope.get(`${product.id}:`);
    const base = Number(
      baseOverride?.price ?? product.sale_price ?? product.base_price,
    );
    const list = variantsByProduct.get(product.id) ?? [];
    const override = priceByScope.get(`${product.id}:${variant.id}`);
    list.push({
      id: variant.id,
      name: variant.name,
      price: Number(
        override?.price ??
          (variant.price == null
            ? base + Number(variant.price_delta)
            : variant.price),
      ),
      available: true,
    });
    variantsByProduct.set(product.id, list);
  }

  const attributeMap = new Map<
    string,
    Record<string, StorefrontAttributeValue>
  >();
  if (productIds.length > 0) {
    // New tables are intentionally accessed through an untyped boundary until generated DB types are refreshed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (admin as any)
      .from("product_attribute_values")
      .select("product_id, value, attribute_definitions!inner(key)")
      .in("product_id", productIds);
    for (const row of rows ?? []) {
      const key = row.attribute_definitions?.key;
      const value = parseAttributeValue(row.value);
      if (typeof key !== "string" || value == null) continue;
      attributeMap.set(row.product_id, {
        ...(attributeMap.get(row.product_id) ?? {}),
        [key]: value,
      });
    }
  }

  const categorySlugById = new Map(
    (categories ?? []).map((category) => [
      category.id,
      slugifyBranchName(category.name, category.id),
    ]),
  );

  const brand = record(settings.storefront_brand as Json | null | undefined);
  const brandName =
    typeof brand.name === "string" && brand.name.trim()
      ? brand.name.trim()
      : organization.name || store.name;

  return {
    slug,
    token: options.token,
    previewToken: options.previewToken,
    storeId: store.id,
    organizationId: store.org_id,
    currency: organization.currency,
    canOrder: availability.canOrder,
    unavailableMessage: availability.canOrder ? null : availability.messageAr,
    contact: {
      phone: store.phone?.trim() || null,
      address: store.address?.trim() || null,
    },
    fulfillment: {
      pickupEnabled: fulfillment.pickupEnabled,
      deliveryEnabled:
        fulfillment.deliveryEnabled && fulfillment.zones.length > 0,
      zones: fulfillment.zones,
    },
    theme: config.theme,
    configVersion: config.configVersion,
    brand: {
      name: brandName,
      logoUrl:
        typeof brand.logoUrl === "string"
          ? brand.logoUrl
          : organization.logo_url,
      coverUrl: typeof brand.coverUrl === "string" ? brand.coverUrl : null,
      tagline:
        typeof brand.tagline === "string" && brand.tagline.trim()
          ? brand.tagline.trim()
          : config.content.heroSubtitle,
    },
    content: config.content,
    homeSections: config.homeSections,
    categories: (categories ?? []).map((category) => ({
      id: category.id,
      slug: categorySlugById.get(category.id)!,
      name: category.name,
      color: category.color,
      icon: category.icon,
    })),
    products: scopedProducts.map((item) => {
      const content = contentByProduct.get(item.id);
      const gallery = mediaByProduct.get(item.id) ?? [];
      const priceOverride = priceByScope.get(`${item.id}:`);
      const rawSpecifications = content?.specifications;
      const specifications = Array.isArray(rawSpecifications)
        ? rawSpecifications.filter(
            (value: unknown): value is { name: string; value: string } =>
              Boolean(
                value &&
                typeof value === "object" &&
                typeof (value as Record<string, unknown>).name === "string" &&
                typeof (value as Record<string, unknown>).value === "string",
              ),
          )
        : [];
      return {
        id: item.id,
        slug: slugifyBranchName(item.name, item.id),
        name:
          typeof content?.title === "string" && content.title.trim()
            ? content.title
            : item.name,
        description:
          typeof content?.description === "string" && content.description.trim()
            ? content.description
            : item.description,
        imageUrl: gallery[0]?.url ?? item.image_url,
        gallery,
        specifications,
        categoryId: item.category_id,
        categorySlug: item.category_id
          ? (categorySlugById.get(item.category_id) ?? null)
          : null,
        price: Number(
          priceOverride?.price ?? item.sale_price ?? item.base_price,
        ),
        compareAtPrice:
          priceOverride?.compare_at_price == null
            ? null
            : Number(priceOverride.compare_at_price),
        available: true,
        isFeatured: item.is_popular,
        variants: variantsByProduct.get(item.id) ?? [],
        attributes: attributeMap.get(item.id) ?? {},
      };
    }),
  };
}
