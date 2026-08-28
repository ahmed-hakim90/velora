import { notFound } from "next/navigation";
import { StorefrontPage } from "@/modules/storefront/components/storefront-page";
import { getStorefrontBySlug } from "@/modules/storefront/services/storefront.service";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; token?: string; preview?: string }> };
export default async function StoreSearch({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const storefront = await getStorefrontBySlug(slug, { token: query.token, previewToken: query.preview });
  if (!storefront) notFound();
  return <StorefrontPage kind="search" storefront={storefront} query={query.q ?? ""} />;
}
