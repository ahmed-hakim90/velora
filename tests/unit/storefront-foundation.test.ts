import { describe, expect, it } from "vitest";
import { validateAttributeValue } from "@/modules/storefront/core/attributes";
import {
  DEFAULT_STOREFRONT_CONFIG,
  normalizeStorefrontConfig,
} from "@/modules/storefront/core/config";
import { cashOnDeliveryProvider } from "@/modules/storefront/core/payment";
import {
  DEFAULT_STOREFRONT_THEME_CATALOG,
  canActivateStorefrontTheme,
  normalizeStorefrontThemeEntitlements,
} from "@/modules/storefront/core/theme-commerce";
import {
  createStorefrontThemeRegistry,
  getStorefrontTheme,
  listStorefrontThemes,
} from "@/modules/storefront/core/theme-registry";
import { buildStorefrontRuntimeSettings } from "@/modules/storefront/core/runtime-settings";
import {
  isStorefrontPreviewValid,
  storefrontPreviewExpiry,
} from "@/modules/storefront/core/preview";
import { canTransitionStorefrontOrder } from "@/modules/storefront/core/order-lifecycle";
import {
  isStorefrontOAuthProvider,
  resolveStorefrontAuthNext,
  STOREFRONT_OAUTH_PROVIDERS,
} from "@/modules/storefront/core/customer-auth";
import { buildStorefrontPath } from "@/modules/storefront/core/urls";

describe("storefront foundation", () => {
  it("falls back to a valid versioned storefront config", () => {
    expect(normalizeStorefrontConfig(null)).toEqual(DEFAULT_STOREFRONT_CONFIG);
    expect(normalizeStorefrontConfig({ configVersion: 999 })).toEqual(
      DEFAULT_STOREFRONT_CONFIG,
    );
    expect(
      normalizeStorefrontConfig({
        theme: "nelaab",
        content: DEFAULT_STOREFRONT_CONFIG.content,
      }),
    ).toEqual(DEFAULT_STOREFRONT_CONFIG);
  });

  it("requires a matching, unexpired preview token", () => {
    const now = new Date("2026-08-29T10:00:00.000Z");
    const token = "a".repeat(32);
    expect(
      isStorefrontPreviewValid({
        providedToken: token,
        storedToken: token,
        expiresAt: storefrontPreviewExpiry(now),
        now,
      }),
    ).toBe(true);
    expect(
      isStorefrontPreviewValid({
        providedToken: token,
        storedToken: token,
        expiresAt: "2026-08-29T09:59:59.000Z",
        now,
      }),
    ).toBe(false);
    expect(
      isStorefrontPreviewValid({
        providedToken: "wrong",
        storedToken: token,
        expiresAt: storefrontPreviewExpiry(now),
        now,
      }),
    ).toBe(false);
  });

  it("registers every theme with a complete page contract", () => {
    expect(listStorefrontThemes()).toHaveLength(1);
    const theme = getStorefrontTheme("unknown");
    expect(theme.manifest.slug).toBe("nelaab");
    expect(Object.keys(theme.pages).sort()).toEqual(
      [
        "Cart",
        "Checkout",
        "Account",
        "Home",
        "Login",
        "Listing",
        "NotFound",
        "Order",
        "Product",
        "Search",
      ].sort(),
    );
  });

  it("rejects duplicate or incomplete executable theme registrations", () => {
    const theme = getStorefrontTheme("nelaab");
    expect(() => createStorefrontThemeRegistry([theme, theme])).toThrow(
      "Duplicate storefront theme",
    );
    expect(() =>
      createStorefrontThemeRegistry([
        { ...theme, pages: { ...theme.pages, Home: null } } as never,
      ]),
    ).toThrow("missing page Home");
  });

  it("keeps the default theme entitled", () => {
    const entitlements = normalizeStorefrontThemeEntitlements({
      enabledThemes: [],
    });
    expect(entitlements.enabledThemes).toContain("nelaab");
    expect(
      canActivateStorefrontTheme(
        "nelaab",
        DEFAULT_STOREFRONT_THEME_CATALOG,
        entitlements,
      ),
    ).toBe(true);
  });

  it("validates typed attribute values", () => {
    expect(
      validateAttributeValue({ key: "age", type: "range" }, { min: 3, max: 5 }),
    ).toEqual({ min: 3, max: 5 });
    expect(
      validateAttributeValue(
        { key: "skills", type: "multi_select", options: ["stem"] },
        ["stem", "stem"],
      ),
    ).toEqual(["stem"]);
    expect(() =>
      validateAttributeValue({ key: "age", type: "range" }, { min: 8, max: 3 }),
    ).toThrow();
  });

  it("creates a pending COD intent without charging", async () => {
    await expect(
      cashOnDeliveryProvider.createIntent({
        method: "cash_on_delivery",
        amount: 120,
        currency: "EGP",
        orderReference: "order-1",
      }),
    ).resolves.toEqual({
      provider: "cash_on_delivery",
      status: "pending_collection",
      reference: "order-1",
    });
  });

  it("enforces an ecommerce order lifecycle", () => {
    expect(canTransitionStorefrontOrder("pending", "confirmed")).toBe(true);
    expect(canTransitionStorefrontOrder("ready_to_ship", "shipped")).toBe(true);
    expect(canTransitionStorefrontOrder("delivered", "returned")).toBe(true);
    expect(canTransitionStorefrontOrder("returned", "refunded")).toBe(true);
    expect(canTransitionStorefrontOrder("delivered", "processing")).toBe(false);
    expect(canTransitionStorefrontOrder("cancelled", "confirmed")).toBe(false);
  });

  it("never falls back from storefront runtime settings to menu settings", () => {
    const runtime = buildStorefrontRuntimeSettings({
      online_menu_ordering_enabled: true,
      online_ordering_paused: false,
      online_ordering_hours: { enforce: false },
      online_fulfillment: { pickupEnabled: true },
      storefront_ordering_enabled: false,
      storefront_ordering_paused: true,
      storefront_hours: { enforce: true, days: {} },
      storefront_fulfillment: {
        pickupEnabled: false,
        deliveryEnabled: true,
        zones: [],
      },
    });
    expect(runtime).toEqual({
      online_menu_ordering_enabled: false,
      online_ordering_paused: true,
      online_ordering_hours: { enforce: true, days: {} },
      online_fulfillment: {
        pickupEnabled: false,
        deliveryEnabled: true,
        zones: [],
      },
    });
  });

  it("keeps customer OAuth separate and redirects only inside the requested store", () => {
    expect(STOREFRONT_OAUTH_PROVIDERS).toEqual(["google", "apple", "facebook"]);
    expect(isStorefrontOAuthProvider("google")).toBe(true);
    expect(isStorefrontOAuthProvider("github")).toBe(false);
    expect(
      resolveStorefrontAuthNext("nelaab", "/store/nelaab/checkout?token=x"),
    ).toBe("/store/nelaab/checkout?token=x");
    expect(resolveStorefrontAuthNext("nelaab", "//evil.example")).toBe(
      "/store/nelaab/checkout",
    );
    expect(resolveStorefrontAuthNext("nelaab", "/store/other/checkout")).toBe(
      "/store/nelaab/checkout",
    );
  });

  it("preserves access and preview context across storefront pages", () => {
    expect(
      buildStorefrontPath(
        { slug: "kids & toys", token: "access", previewToken: "draft" },
        "order/abc",
      ),
    ).toBe("/store/kids%20%26%20toys/order/abc?preview=draft&token=access");
    expect(buildStorefrontPath({ slug: "public" }, "/cart")).toBe(
      "/store/public/cart",
    );
  });
});
