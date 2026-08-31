import { redirect } from "next/navigation";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { getStore } from "@/lib/repositories/store.repository";
import { buildStorefrontPath } from "@/modules/storefront/core/urls";

export default async function StorefrontPreviewRedirectPage() {
  const access = await requirePageStoreId("/storefront/settings");
  if (!access.ok) redirect("/storefront/settings");
  const store = await getStore(access.storeId);
  const slug =
    typeof store?.settings.storefront_slug === "string"
      ? store.settings.storefront_slug
      : "";
  const previewToken =
    typeof store?.settings.storefront_preview_token === "string"
      ? store.settings.storefront_preview_token
      : "";
  const accessToken =
    store?.settings.storefront_unlisted === true &&
    typeof store.settings.storefront_token === "string"
      ? store.settings.storefront_token
      : null;
  if (!slug || !previewToken) redirect("/storefront/settings");
  redirect(buildStorefrontPath({ slug, previewToken, token: accessToken }));
}
