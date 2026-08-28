import type { StorefrontThemeSlug } from "./types";

export const STOREFRONT_THEME_CATALOG_KEY = "storefront_theme_catalog";
export const STOREFRONT_THEME_ENTITLEMENTS_KEY = "storefront_theme_entitlements";
export const DEFAULT_STOREFRONT_THEME: StorefrontThemeSlug = "nelaab";

export type StorefrontThemeCatalogEntry = {
  slug: StorefrontThemeSlug;
  version: number;
  priceEgp: number;
  globallyAvailable: boolean;
  notes: string;
};

export type StorefrontThemeCatalog = Record<StorefrontThemeSlug, StorefrontThemeCatalogEntry>;
export type StorefrontThemeEntitlements = { enabledThemes: StorefrontThemeSlug[]; notes: string };

export const DEFAULT_STOREFRONT_THEME_CATALOG: StorefrontThemeCatalog = {
  nelaab: { slug: "nelaab", version: 1, priceEgp: 0, globallyAvailable: true, notes: "الثيم الافتراضي" },
};

export const DEFAULT_STOREFRONT_THEME_ENTITLEMENTS: StorefrontThemeEntitlements = {
  enabledThemes: [DEFAULT_STOREFRONT_THEME],
  notes: "",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeStorefrontThemeCatalog(value: unknown): StorefrontThemeCatalog {
  const raw = record(record(value).nelaab);
  const price = Number(raw.priceEgp);
  return {
    nelaab: {
      slug: "nelaab",
      version: Number.isInteger(raw.version) && Number(raw.version) > 0 ? Number(raw.version) : 1,
      priceEgp: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : 0,
      globallyAvailable: typeof raw.globallyAvailable === "boolean" ? raw.globallyAvailable : true,
      notes: typeof raw.notes === "string" ? raw.notes.trim() : "الثيم الافتراضي",
    },
  };
}

export function normalizeStorefrontThemeEntitlements(value: unknown): StorefrontThemeEntitlements {
  const raw = record(value);
  const enabled = Array.isArray(raw.enabledThemes)
    ? raw.enabledThemes.filter((item): item is StorefrontThemeSlug => item === "nelaab")
    : [];
  if (!enabled.includes(DEFAULT_STOREFRONT_THEME)) enabled.unshift(DEFAULT_STOREFRONT_THEME);
  return { enabledThemes: [...new Set(enabled)], notes: typeof raw.notes === "string" ? raw.notes.trim() : "" };
}

export function canActivateStorefrontTheme(
  theme: StorefrontThemeSlug,
  catalog: StorefrontThemeCatalog,
  entitlements: StorefrontThemeEntitlements,
) {
  const entry = catalog[theme];
  return theme === DEFAULT_STOREFRONT_THEME || Boolean(entry?.globallyAvailable && entitlements.enabledThemes.includes(theme));
}
