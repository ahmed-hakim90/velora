import type { ComponentType, CSSProperties, ReactNode } from "react";

export type StorefrontThemeSlug = "nelaab";
export type StorefrontPageKind =
  | "home"
  | "listing"
  | "search"
  | "product"
  | "cart"
  | "checkout"
  | "order"
  | "login"
  | "account"
  | "categories"
  | "offers"
  | "wishlist"
  | "track"
  | "about"
  | "contact"
  | "policy"
  | "notFound";

export type StorefrontSectionSlot =
  | "hero"
  | "ageSelector"
  | "featuredCategories"
  | "featuredProducts"
  | "benefits";

export type StorefrontHomeSection = {
  id: StorefrontSectionSlot;
  enabled: boolean;
};

export interface StorefrontThemeTokens {
  colors: {
    background: string;
    surface: string;
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    danger: string;
    success: string;
    text: string;
    mutedText: string;
    border: string;
  };
  fonts: { heading: string; body: string };
  radius: { card: string; control: string; hero: string };
  shadow: { card: string; hover: string; overlay: string };
  motion: { fast: string; normal: string; slow: string };
}

export interface StorefrontThemeManifest {
  slug: StorefrontThemeSlug;
  version: number;
  nameAr: string;
  descriptionAr: string;
  preview: { background: string; primary: string; accent: string };
  capabilities: { rtl: boolean; ltr: boolean; productImages: boolean };
  sectionSlots: readonly StorefrontSectionSlot[];
  tokens: StorefrontThemeTokens;
}

export interface StorefrontBrand {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  tagline: string;
}

export interface StorefrontVariant {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export type StorefrontAttributeValue =
  string | number | boolean | string[] | { min: number; max: number };

export interface StorefrontProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  gallery: { id: string; url: string; altText: string }[];
  specifications: { name: string; value: string }[];
  categoryId: string | null;
  categorySlug: string | null;
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  isFeatured: boolean;
  variants: StorefrontVariant[];
  attributes: Record<string, StorefrontAttributeValue>;
}

export interface StorefrontCategory {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string;
}

export interface StorefrontContent {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string | null;
  heroCtaLabel: string;
  featuredTitle: string;
  benefitsTitle: string;
}

export interface StorefrontData {
  slug: string;
  token?: string | null;
  previewToken?: string | null;
  storeId: string;
  organizationId: string;
  currency: string;
  canOrder: boolean;
  unavailableMessage: string | null;
  contact: {
    phone: string | null;
    address: string | null;
  };
  fulfillment: {
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
    zones: { id: string; name: string; fee: number }[];
  };
  theme: StorefrontThemeSlug;
  configVersion: number;
  brand: StorefrontBrand;
  content: StorefrontContent;
  homeSections: StorefrontHomeSection[];
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
}

export type StorefrontCartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
};

export type StorefrontThemePageProps = {
  storefront: StorefrontData;
  categorySlug?: string;
  productSlug?: string;
  query?: string;
  orderToken?: string;
  order?: StorefrontOrderSummary;
  customerAccount?: StorefrontCustomerAccountSummary | null;
  authError?: string;
  policyKind?: "privacy" | "returns" | "terms";
};

export type StorefrontOrderSummary = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  grandTotal: number;
  currency: string;
  placedAt: string;
  items: { name: string; quantity: number; lineTotal: number }[];
};

export type StorefrontCustomerAccountSummary = {
  displayName: string;
  email: string | null;
  customerId: string | null;
  addresses: {
    id: string;
    label: string;
    addressLine: string;
    area: string;
    city: string;
    isDefault: boolean;
  }[];
  orders: {
    orderNumber: string;
    trackingToken: string;
    status: string;
    grandTotal: number;
    currency: string;
    placedAt: string;
  }[];
};

export type StorefrontThemePage = ComponentType<StorefrontThemePageProps>;

export interface StorefrontThemePages {
  Home: StorefrontThemePage;
  Listing: StorefrontThemePage;
  Search: StorefrontThemePage;
  Product: StorefrontThemePage;
  Cart: StorefrontThemePage;
  Checkout: StorefrontThemePage;
  Order: StorefrontThemePage;
  Login: StorefrontThemePage;
  Account: StorefrontThemePage;
  Categories: StorefrontThemePage;
  Offers: StorefrontThemePage;
  Wishlist: StorefrontThemePage;
  Track: StorefrontThemePage;
  About: StorefrontThemePage;
  Contact: StorefrontThemePage;
  Policy: StorefrontThemePage;
  NotFound: StorefrontThemePage;
}

export interface StorefrontThemeDefinition {
  manifest: StorefrontThemeManifest;
  pages: StorefrontThemePages;
  Shell: ComponentType<{ storefront: StorefrontData; children: ReactNode }>;
}

export function storefrontTokenStyle(
  tokens: StorefrontThemeTokens,
): CSSProperties {
  return {
    "--sf-bg": tokens.colors.background,
    "--sf-surface": tokens.colors.surface,
    "--sf-primary": tokens.colors.primary,
    "--sf-primary-fg": tokens.colors.primaryForeground,
    "--sf-accent": tokens.colors.accent,
    "--sf-accent-fg": tokens.colors.accentForeground,
    "--sf-danger": tokens.colors.danger,
    "--sf-success": tokens.colors.success,
    "--sf-text": tokens.colors.text,
    "--sf-muted": tokens.colors.mutedText,
    "--sf-border": tokens.colors.border,
    "--sf-font-heading": tokens.fonts.heading,
    "--sf-font-body": tokens.fonts.body,
    "--sf-card-radius": tokens.radius.card,
    "--sf-control-radius": tokens.radius.control,
    "--sf-hero-radius": tokens.radius.hero,
    "--sf-card-shadow": tokens.shadow.card,
    "--sf-hover-shadow": tokens.shadow.hover,
  } as CSSProperties;
}
