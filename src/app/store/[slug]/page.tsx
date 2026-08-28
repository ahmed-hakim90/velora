import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontPage } from "@/modules/storefront/components/storefront-page";
import { getStorefrontBySlug } from "@/modules/storefront/services/storefront.service";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; preview?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const storefront = await getStorefrontBySlug(slug, {
    token: query.token,
    previewToken: query.preview,
    skipRateLimit: true,
  });
  return storefront
    ? {
        title: storefront.brand.name,
        description: storefront.brand.tagline,
        robots:
          query.token || query.preview
            ? { index: false, follow: false }
            : { index: true, follow: true },
      }
    : { title: "المتجر غير موجود", robots: { index: false } };
}

export default async function StoreHome({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const storefront = await getStorefrontBySlug(slug, {
    token: query.token,
    previewToken: query.preview,
  });
  if (!storefront) notFound();
  return <StorefrontPage kind="home" storefront={storefront} />;
}
