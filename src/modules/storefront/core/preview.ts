export const STOREFRONT_PREVIEW_TTL_MINUTES = 30;

export function storefrontPreviewExpiry(now = new Date()): string {
  return new Date(now.getTime() + STOREFRONT_PREVIEW_TTL_MINUTES * 60_000).toISOString();
}

export function isStorefrontPreviewValid(input: {
  providedToken: unknown;
  storedToken: unknown;
  expiresAt: unknown;
  now?: Date;
}): boolean {
  if (typeof input.providedToken !== "string" || !input.providedToken) return false;
  if (typeof input.storedToken !== "string" || input.storedToken.length < 24) return false;
  if (input.providedToken !== input.storedToken) return false;
  if (typeof input.expiresAt !== "string") return false;
  const expiry = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiry)) return false;
  return expiry > (input.now ?? new Date()).getTime();
}
