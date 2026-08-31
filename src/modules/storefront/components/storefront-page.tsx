"use client";

import { getStorefrontTheme } from "../core/theme-registry";
import type {
  StorefrontData,
  StorefrontPageKind,
  StorefrontThemePageProps,
} from "../core/types";

const pageKey = {
  home: "Home",
  listing: "Listing",
  search: "Search",
  product: "Product",
  cart: "Cart",
  checkout: "Checkout",
  order: "Order",
  notFound: "NotFound",
  login: "Login",
  account: "Account",
  categories: "Categories",
  offers: "Offers",
  wishlist: "Wishlist",
  track: "Track",
  about: "About",
  contact: "Contact",
  policy: "Policy",
} as const;

export function StorefrontPage({
  kind,
  storefront,
  ...props
}: { kind: StorefrontPageKind; storefront: StorefrontData } & Omit<
  StorefrontThemePageProps,
  "storefront"
>) {
  const theme = getStorefrontTheme(storefront.theme);
  const Page = theme.pages[pageKey[kind]];
  return (
    <theme.Shell storefront={storefront}>
      <Page storefront={storefront} {...props} />
    </theme.Shell>
  );
}
