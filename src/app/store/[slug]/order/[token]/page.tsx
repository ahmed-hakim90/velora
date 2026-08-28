import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontPage } from "@/modules/storefront/components/storefront-page";
import { getStorefrontBySlug } from "@/modules/storefront/services/storefront.service";
import { getPublicStorefrontOrder } from "@/modules/storefront/services/storefront-order.service";
export const metadata: Metadata = {
  title: "تم استلام الطلب",
  robots: { index: false, follow: false },
};
type Props = {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ token?: string; preview?: string }>;
};
export default async function StoreOrder({ params, searchParams }: Props) {
  const [{ slug, token: orderToken }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const decodedToken = decodeURIComponent(orderToken);
  const storefront = await getStorefrontBySlug(slug, {
    token: query.token,
    previewToken: query.preview,
  });
  if (!storefront) notFound();
  const order = await getPublicStorefrontOrder(
    decodedToken,
    storefront.storeId,
  );
  if (!order) notFound();
  return (
    <StorefrontPage
      kind="order"
      storefront={storefront}
      orderToken={decodedToken}
      order={order}
    />
  );
}
