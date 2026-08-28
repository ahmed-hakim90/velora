export const STOREFRONT_OAUTH_PROVIDERS = [
  "google",
  "apple",
  "facebook",
] as const;
export type StorefrontOAuthProvider =
  (typeof STOREFRONT_OAUTH_PROVIDERS)[number];

export function isStorefrontOAuthProvider(
  value: string,
): value is StorefrontOAuthProvider {
  return STOREFRONT_OAUTH_PROVIDERS.includes(value as StorefrontOAuthProvider);
}

export function resolveStorefrontAuthNext(
  slug: string,
  value: string | null,
): string {
  const base = `/store/${encodeURIComponent(slug)}`;
  if (!value || !value.startsWith(`${base}/`) || value.startsWith("//"))
    return `${base}/checkout`;
  return value;
}
