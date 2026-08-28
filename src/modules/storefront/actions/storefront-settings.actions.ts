"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { canActivateStorefrontTheme } from "../core/theme-commerce";
import { storefrontConfigSchema, type StorefrontConfig } from "../core/config";
import {
  getOrgStorefrontThemeEntitlements,
  getStorefrontThemeCatalog,
} from "@/modules/platform/services/platform-storefront-themes.service";
import {
  serializeOnlineFulfillment,
  validateOnlineFulfillmentInput,
  type OnlineFulfillmentConfig,
} from "@/modules/online-menu/lib/online-fulfillment";
import {
  serializeOnlineOrderingHours,
  validateOnlineOrderingHoursInput,
  type OnlineOrderingHoursConfig,
} from "@/modules/online-menu/lib/online-ordering-hours";
import { storefrontPreviewExpiry } from "../core/preview";

type RecordValue = Record<string, unknown>;

export type StorefrontPublicSettingsInput = {
  enabled: boolean;
  orderingEnabled: boolean;
  slug: string;
  unlisted: boolean;
  customDomainEnabled: boolean;
  brandName: string;
  tagline: string;
  orderingPaused: boolean;
  hours: OnlineOrderingHoursConfig;
  fulfillment: OnlineFulfillmentConfig;
};

async function ownedStore(storeId: string, orgId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stores")
    .select("id, settings")
    .eq("id", storeId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("الفرع غير موجود");
  return data;
}

export async function saveStorefrontDraftAction(
  storeId: string,
  input: StorefrontConfig,
  publicInput: StorefrontPublicSettingsInput,
) {
  const user = await requirePermissionOrRole("settings_manage", [
    "owner",
    "manager",
  ]);
  const config = storefrontConfigSchema.parse(input);
  const [store, catalog, entitlements] = await Promise.all([
    ownedStore(storeId, user.org_id),
    getStorefrontThemeCatalog(),
    getOrgStorefrontThemeEntitlements(user.org_id),
  ]);
  if (!canActivateStorefrontTheme(config.theme, catalog, entitlements))
    throw new Error("هذا الثيم غير مفعّل لشركتك");
  const slug = publicInput.slug.trim().toLowerCase();
  if (slug.length < 2 || !/^[a-z0-9\u0600-\u06FF-]+$/i.test(slug))
    throw new Error("رابط المتجر غير صالح");
  const current = (
    store.settings &&
    typeof store.settings === "object" &&
    !Array.isArray(store.settings)
      ? store.settings
      : {}
  ) as RecordValue;
  if (publicInput.customDomainEnabled) {
    const admin = createAdminClient();
    const { data: siblings, error: siblingError } = await admin
      .from("stores")
      .select("id, name, settings")
      .eq("org_id", user.org_id)
      .neq("id", storeId)
      .eq("is_active", true);
    if (siblingError) throw new Error(siblingError.message);
    const conflict = (siblings ?? []).find((sibling) => {
      const siblingSettings =
        sibling.settings &&
        typeof sibling.settings === "object" &&
        !Array.isArray(sibling.settings)
          ? (sibling.settings as RecordValue)
          : {};
      return siblingSettings.storefront_domain_enabled === true;
    });
    if (conflict)
      throw new Error(
        `الدومين مخصص حاليًا لمتجر ${conflict.name}. عطّله هناك أولًا.`,
      );
  }
  const hours = validateOnlineOrderingHoursInput(publicInput.hours);
  const fulfillment = validateOnlineFulfillmentInput(publicInput.fulfillment);
  const settings = {
    ...current,
    storefront_enabled: publicInput.enabled,
    storefront_ordering_enabled: publicInput.orderingEnabled,
    storefront_ordering_paused: publicInput.orderingPaused,
    storefront_hours: serializeOnlineOrderingHours(hours),
    storefront_slug: slug,
    storefront_unlisted: publicInput.unlisted,
    storefront_domain_enabled: publicInput.customDomainEnabled,
    storefront_token:
      typeof current.storefront_token === "string" && current.storefront_token
        ? current.storefront_token
        : crypto.randomBytes(24).toString("base64url"),
    storefront_brand: {
      ...(current.storefront_brand &&
      typeof current.storefront_brand === "object" &&
      !Array.isArray(current.storefront_brand)
        ? (current.storefront_brand as RecordValue)
        : {}),
      name: publicInput.brandName.trim().slice(0, 120),
      tagline: publicInput.tagline.trim().slice(0, 240),
    },
    storefront_fulfillment: serializeOnlineFulfillment(fulfillment),
    storefront_draft: config,
    storefront_preview_token: crypto.randomBytes(24).toString("base64url"),
    storefront_preview_expires_at: storefrontPreviewExpiry(),
  };
  const admin = createAdminClient();
  const { error } = await admin
    .from("stores")
    .update({ settings: settings as unknown as Json })
    .eq("id", storeId)
    .eq("org_id", user.org_id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return {
    previewToken: settings.storefront_preview_token,
    expiresAt: settings.storefront_preview_expires_at,
    accessToken: settings.storefront_token,
  };
}

export async function publishStorefrontDraftAction(storeId: string) {
  const user = await requirePermissionOrRole("settings_manage", [
    "owner",
    "manager",
  ]);
  const store = await ownedStore(storeId, user.org_id);
  const current = (
    store.settings &&
    typeof store.settings === "object" &&
    !Array.isArray(store.settings)
      ? store.settings
      : {}
  ) as RecordValue;
  const config = storefrontConfigSchema.parse(current.storefront_draft);
  const [catalog, entitlements] = await Promise.all([
    getStorefrontThemeCatalog(),
    getOrgStorefrontThemeEntitlements(user.org_id),
  ]);
  if (!canActivateStorefrontTheme(config.theme, catalog, entitlements))
    throw new Error("لا يمكن نشر ثيم غير مفعّل لشركتك");
  if (current.storefront_enabled !== true)
    throw new Error("فعّل المتجر قبل النشر");
  const settings = { ...current, storefront_published: config };
  const admin = createAdminClient();
  const { error } = await admin
    .from("stores")
    .update({ settings: settings as unknown as Json })
    .eq("id", storeId)
    .eq("org_id", user.org_id);
  if (error) throw new Error(error.message);
  revalidatePath("/store", "layout");
  return config;
}
