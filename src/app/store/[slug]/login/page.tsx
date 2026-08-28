import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontPage } from "@/modules/storefront/components/storefront-page";
import { getStorefrontBySlug } from "@/modules/storefront/services/storefront.service";
import { getStorefrontCustomerAccount } from "@/modules/storefront/services/storefront-customer-account.service";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    token?: string;
    preview?: string;
    auth_error?: string;
  }>;
};

export default async function StoreLogin({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const storefront = await getStorefrontBySlug(slug, {
    token: query.token,
    previewToken: query.preview,
  });
  if (!storefront) notFound();
  const customerAccount = await getStorefrontCustomerAccount(
    storefront.organizationId,
  );
  return (
    <StorefrontPage
      kind="login"
      storefront={storefront}
      authError={query.auth_error}
      customerAccount={customerAccount}
    />
  );
}
