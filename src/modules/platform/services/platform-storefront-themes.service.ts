import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  DEFAULT_STOREFRONT_THEME_CATALOG,
  STOREFRONT_THEME_CATALOG_KEY,
  STOREFRONT_THEME_ENTITLEMENTS_KEY,
  normalizeStorefrontThemeCatalog,
  normalizeStorefrontThemeEntitlements,
  type StorefrontThemeCatalog,
  type StorefrontThemeEntitlements,
} from "@/modules/storefront/core/theme-commerce";
import type { PlatformAdmin } from "./platform-admin.service";
import { auditAs } from "./platform-audit.service";

export async function getStorefrontThemeCatalog(): Promise<StorefrontThemeCatalog> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("platform_settings").select("value").eq("key", STOREFRONT_THEME_CATALOG_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeStorefrontThemeCatalog(data?.value ?? DEFAULT_STOREFRONT_THEME_CATALOG);
}

export async function setStorefrontThemeCatalog(actor: PlatformAdmin, catalog: StorefrontThemeCatalog) {
  const normalized = normalizeStorefrontThemeCatalog(catalog);
  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert({ key: STOREFRONT_THEME_CATALOG_KEY, value: normalized as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  await auditAs(actor, { action: "storefront_themes.catalog_update", entityType: "platform_settings", entityId: STOREFRONT_THEME_CATALOG_KEY, metadata: normalized });
  return normalized;
}

export async function getOrgStorefrontThemeEntitlements(orgId: string): Promise<StorefrontThemeEntitlements> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("app_settings").select("value").eq("org_id", orgId).eq("key", STOREFRONT_THEME_ENTITLEMENTS_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeStorefrontThemeEntitlements(data?.value);
}

export async function setOrgStorefrontThemeEntitlements(actor: PlatformAdmin, orgId: string, input: StorefrontThemeEntitlements) {
  const normalized = normalizeStorefrontThemeEntitlements(input);
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert({ org_id: orgId, key: STOREFRONT_THEME_ENTITLEMENTS_KEY, value: normalized as unknown as Json }, { onConflict: "org_id,key" });
  if (error) throw new Error(error.message);
  await auditAs(actor, { action: "storefront_themes.entitlements_update", entityType: "organization", entityId: orgId, metadata: normalized });
  return normalized;
}
