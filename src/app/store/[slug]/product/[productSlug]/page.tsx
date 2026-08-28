import { notFound } from "next/navigation";
import { StorefrontPage } from "@/modules/storefront/components/storefront-page";
import { getStorefrontBySlug } from "@/modules/storefront/services/storefront.service";
type Props = { params: Promise<{ slug: string; productSlug: string }>; searchParams: Promise<{ token?: string; preview?: string }> };
export default async function StoreProduct({ params, searchParams }: Props) {
  const [{ slug, productSlug }, query] = await Promise.all([params, searchParams]);
  const storefront = await getStorefrontBySlug(slug, { token: query.token, previewToken: query.preview });
  if (!storefront) notFound();
  return <StorefrontPage kind="product" storefront={storefront} productSlug={decodeURIComponent(productSlug)} />;
}
