type StorefrontUrlContext = {
  slug: string;
  token?: string | null;
  previewToken?: string | null;
};

export function buildStorefrontPath(
  storefront: StorefrontUrlContext,
  path = "",
): string {
  const [pathname, rawQuery = ""] = path.split("?", 2);
  const normalizedPath =
    pathname && !pathname.startsWith("/") ? `/${pathname}` : pathname;
  const params = new URLSearchParams(rawQuery);
  if (storefront.previewToken) params.set("preview", storefront.previewToken);
  if (storefront.token) params.set("token", storefront.token);
  const query = params.size ? `?${params.toString()}` : "";
  return `/store/${encodeURIComponent(storefront.slug)}${normalizedPath}${query}`;
}
