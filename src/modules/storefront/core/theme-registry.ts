import { nelaabTheme } from "../themes/nelaab/nelaab-theme";
import type { StorefrontThemeDefinition, StorefrontThemeSlug } from "./types";

const REQUIRED_PAGES = [
  "Home",
  "Listing",
  "Search",
  "Product",
  "Cart",
  "Checkout",
  "Order",
  "Login",
  "Account",
  "Categories",
  "Offers",
  "Wishlist",
  "Track",
  "About",
  "Contact",
  "Policy",
  "NotFound",
] as const;

export function createStorefrontThemeRegistry(
  definitions: StorefrontThemeDefinition[],
) {
  const result = {} as Record<StorefrontThemeSlug, StorefrontThemeDefinition>;
  for (const definition of definitions) {
    const { manifest } = definition;
    if (
      !manifest.slug ||
      !Number.isInteger(manifest.version) ||
      manifest.version < 1
    ) {
      throw new Error("Invalid storefront theme manifest");
    }
    if (result[manifest.slug])
      throw new Error(`Duplicate storefront theme: ${manifest.slug}`);
    if (typeof definition.Shell !== "function")
      throw new Error(`Theme ${manifest.slug} has no shell`);
    for (const page of REQUIRED_PAGES) {
      if (typeof definition.pages[page] !== "function") {
        throw new Error(`Theme ${manifest.slug} is missing page ${page}`);
      }
    }
    result[manifest.slug] = Object.freeze(definition);
  }
  return Object.freeze(result);
}

const registry = createStorefrontThemeRegistry([nelaabTheme]);

export function getStorefrontTheme(
  slug: string | null | undefined,
): StorefrontThemeDefinition {
  return slug === "nelaab" ? registry.nelaab : registry.nelaab;
}

export function listStorefrontThemes(): StorefrontThemeDefinition[] {
  return Object.values(registry);
}
