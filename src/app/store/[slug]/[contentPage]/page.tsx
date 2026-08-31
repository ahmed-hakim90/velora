import { notFound } from "next/navigation";
import { StorefrontPage } from "@/modules/storefront/components/storefront-page";
import type {
  StorefrontPageKind,
  StorefrontThemePageProps,
} from "@/modules/storefront/core/types";
import { getStorefrontBySlug } from "@/modules/storefront/services/storefront.service";

type Props = {
  params: Promise<{ slug: string; contentPage: string }>;
  searchParams: Promise<{ token?: string; preview?: string }>;
};

const pages: Record<
  string,
  {
    kind: StorefrontPageKind;
    policyKind?: StorefrontThemePageProps["policyKind"];
  }
> = {
  categories: { kind: "categories" },
  offers: { kind: "offers" },
  wishlist: { kind: "wishlist" },
  "track-order": { kind: "track" },
  about: { kind: "about" },
  contact: { kind: "contact" },
  privacy: { kind: "policy", policyKind: "privacy" },
  returns: { kind: "policy", policyKind: "returns" },
  terms: { kind: "policy", policyKind: "terms" },
};

export default async function StoreContentPage({
  params,
  searchParams,
}: Props) {
  const [{ slug, contentPage }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = pages[contentPage];
  if (!page) notFound();
  const storefront = await getStorefrontBySlug(slug, {
    token: query.token,
    previewToken: query.preview,
  });
  if (!storefront) notFound();
  return (
    <StorefrontPage
      kind={page.kind}
      storefront={storefront}
      policyKind={page.policyKind}
    />
  );
}
