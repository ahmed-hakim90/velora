"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { firstGrapheme } from "@/lib/first-grapheme";
import { submitPublicOnlineOrderAction } from "@/modules/online-orders/actions/public-online-order.actions";
import { getMenuTheme } from "@/modules/online-menu/lib/menu-themes";
import type { OnlineMenuData, OnlineMenuItem, OnlineMenuVariant } from "@/modules/online-menu/services/online-menu.service";
import { formatCurrency } from "@/lib/format";
import { resolveDisplayPriceRange } from "@/modules/products/lib/display-price-range";
import { useTranslation } from "@/lib/i18n/use-translation";

type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
};

type Group = {
  id: string;
  name: string;
  color: string;
  icon: string;
  items: OnlineMenuItem[];
};

type CustomerForm = {
  name: string;
  phone: string;
  notes: string;
};

type FulfillmentForm = {
  type: "pickup" | "delivery";
  zoneId: string;
  address: string;
};

function lineId(productId: string, variantId: string | null) {
  return `${productId}:${variantId ?? ""}`;
}

function getMenuItemDisplayPrice(item: OnlineMenuItem, currency: string, language: "ar" | "en") {
  const variantPrices = item.variants
    .map((variant) => variant.price)
    .filter((price) => Number.isFinite(price));
  const hasVariantPrice = variantPrices.length > 0;
  const { amount, rangeLabel } = resolveDisplayPriceRange({
    variantPrices,
    baseAmount: item.price,
    currency,
    rangeSeparator: language === "ar" ? "arabic" : "en-dash",
  });
  const min = [...variantPrices].sort((a, b) => a - b)[0];
  const max = [...variantPrices].sort((a, b) => a - b).at(-1);

  return {
    label: hasVariantPrice
      ? max != null && min != null && max > min
        ? "From lowest price"
        : "Variant price"
      : null,
    amount,
    range: rangeLabel,
  };
}

const DEFAULT_CATEGORY_COLOR = "#94A3B8";

function isImageIcon(icon: string) {
  return icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

function CategoryMark({ group, size = "sm" }: { group: Group; size?: "sm" | "lg" }) {
  const color = group.color || DEFAULT_CATEGORY_COLOR;
  const markSize = size === "lg" ? "size-14 rounded-2xl text-xl" : "size-6 rounded-full text-xs";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white shadow-sm ${markSize}`}
      style={{ backgroundColor: color }}
    >
      {isImageIcon(group.icon) ? (
        <Image
          src={group.icon}
          alt=""
          fill
          sizes={size === "lg" ? "56px" : "24px"}
          unoptimized
          className="object-cover"
        />
      ) : (
        firstGrapheme(group.name)
      )}
    </span>
  );
}

interface OnlineMenuOrderingClientProps {
  slug: string;
  token?: string;
  menu: OnlineMenuData;
}

export function OnlineMenuOrderingClient({ slug, token, menu }: OnlineMenuOrderingClientProps) {
  const { t, language } = useTranslation();
  const theme = getMenuTheme(menu.store.theme);
  const isListLayout = theme.layout === "list";
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerForm>({ name: "", phone: "", notes: "" });
  const [couponCode, setCouponCode] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentForm>(() => {
    const config = menu.store.fulfillment;
    const defaultType =
      config.pickupEnabled ? "pickup" : config.deliveryEnabled ? "delivery" : "pickup";
    return {
      type: defaultType,
      zoneId: config.zones[0]?.id ?? "",
      address: "",
    };
  });
  const [lastOrder, setLastOrder] = useState<{
    id: string;
    trackingPath: string;
  } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerPrompt, setCustomerPrompt] = useState<string | null>(null);
  const [phoneConfirmNeeded, setPhoneConfirmNeeded] = useState(false);
  const [cartDetailsOpen, setCartDetailsOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"review" | "details" | "success">("review");
  const [recentlyAddedLineId, setRecentlyAddedLineId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const fulfillmentConfig = menu.store.fulfillment;

  function openCart(step: "review" | "details" | "success" = "review") {
    setCheckoutStep(step);
    setIsCartOpen(true);
  }

  function openCartFromBar() {
    if (lastOrder && cart.length === 0) {
      openCart("success");
      return;
    }
    openCart("review");
  }

  function closeCart() {
    setIsCartOpen(false);
    setCheckoutStep("review");
    setCartDetailsOpen(false);
    setCustomerPrompt(null);
    setPhoneConfirmNeeded(false);
  }

  function goToCheckoutDetails() {
    if (cart.length === 0) return;
    if (!fulfillmentConfig.pickupEnabled && !fulfillmentConfig.deliveryEnabled) {
      toast.error(t("Fulfillment methods are not configured for this store"));
      return;
    }
    if (fulfillment.type === "pickup" && !fulfillmentConfig.pickupEnabled) {
      toast.error(t("Store pickup is unavailable"));
      return;
    }
    if (fulfillment.type === "delivery") {
      if (!fulfillmentConfig.deliveryEnabled) {
        toast.error(t("Delivery is unavailable"));
        return;
      }
      if (!fulfillment.zoneId) {
        toast.error(t("Choose a delivery zone"));
        return;
      }
      if (fulfillment.address.trim().length < 5) {
        toast.error(t("Enter a delivery address of at least 5 characters"));
        return;
      }
    }
    setCustomerPrompt(null);
    setCheckoutStep("details");
  }

  const groups = useMemo<Group[]>(() => {
    const uncategorized = menu.items.filter((item) => !item.categoryId);
    const categories = menu.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color || DEFAULT_CATEGORY_COLOR,
        icon: category.icon,
        items: menu.items.filter((item) => item.categoryId === category.id),
      }))
      .filter((category) => category.items.length > 0);
    return uncategorized.length > 0
      ? [
          ...categories,
          {
            id: "other",
            name: t("Other items"),
            color: DEFAULT_CATEGORY_COLOR,
            icon: "",
            items: uncategorized,
          },
        ]
      : categories;
  }, [menu.categories, menu.items, t]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleGroups = useMemo<Group[]>(() => {
    if (!normalizedSearchQuery) return groups;

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const searchableText = [
            item.name,
            item.description,
            ...item.variants.map((variant) => variant.name),
          ]
            .join(" ")
            .toLowerCase();
          return searchableText.includes(normalizedSearchQuery);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedSearchQuery]);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const cartItemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedZone = fulfillmentConfig.zones.find((zone) => zone.id === fulfillment.zoneId);
  const deliveryFee =
    fulfillment.type === "delivery" && selectedZone ? selectedZone.fee : 0;
  const orderTotal = subtotal + deliveryFee;

  useEffect(() => {
    if (!recentlyAddedLineId) return;
    const timeoutId = window.setTimeout(() => setRecentlyAddedLineId(null), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [recentlyAddedLineId]);

  useEffect(() => {
    if (cart.length === 0 && checkoutStep === "details") {
      setCheckoutStep("review");
    }
  }, [cart.length, checkoutStep]);

  function addToCart(item: OnlineMenuItem, variant: OnlineMenuVariant | null = null) {
    if (!menu.store.canOrder) return;
    const id = lineId(item.id, variant?.id ?? null);
    const unitPrice = variant?.price ?? item.price;
    setLastOrder(null);
    setRecentlyAddedLineId(id);
    setCart((current) => {
      const existing = current.find((line) => line.id === id);
      if (existing) {
        return current.map((line) =>
          line.id === id
            ? { ...line, quantity: Math.min(99, line.quantity + 1) }
            : line
        );
      }
      return [
        ...current,
        {
          id,
          productId: item.id,
          variantId: variant?.id ?? null,
          name: item.name,
          variantName: variant?.name ?? null,
          unitPrice,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(id: string, quantity: number) {
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.id !== id)
        : current.map((line) => (line.id === id ? { ...line, quantity: Math.min(99, quantity) } : line))
    );
  }

  function submitOrder(options: { allowNameOnly?: boolean } = {}) {
    if (!menu.store.canOrder) return;
    const customerName = customer.name.trim();
    const customerPhone = customer.phone.trim();
    if (customerPhone && customerPhone.length < 5) {
      setCustomerPrompt(t("The phone number is too short. Correct it or continue with your name only."));
      setCheckoutStep("details");
      return;
    }
    if (!customerName) {
      setCustomerPrompt(t("Enter your name so we can prepare the order correctly."));
      setCheckoutStep("details");
      return;
    }
    if (!customerPhone && !options.allowNameOnly && !phoneConfirmNeeded) {
      setCustomerPrompt(
        t("You can continue with your name only. Adding a phone helps us confirm the order.")
      );
      setPhoneConfirmNeeded(true);
      setCheckoutStep("details");
      return;
    }

    if (!fulfillmentConfig.pickupEnabled && !fulfillmentConfig.deliveryEnabled) {
      toast.error(t("Fulfillment methods are not configured for this store"));
      return;
    }
    if (fulfillment.type === "pickup" && !fulfillmentConfig.pickupEnabled) {
      toast.error(t("Store pickup is unavailable"));
      return;
    }
    if (fulfillment.type === "delivery") {
      if (!fulfillmentConfig.deliveryEnabled) {
        toast.error(t("Delivery is unavailable"));
        return;
      }
      if (!fulfillment.zoneId) {
        toast.error(t("Choose a delivery zone"));
        return;
      }
      if (fulfillment.address.trim().length < 5) {
        toast.error(t("Enter a delivery address of at least 5 characters"));
        return;
      }
    }

    setCustomerPrompt(null);
    startTransition(async () => {
      try {
        const result = await submitPublicOnlineOrderAction({
          slug,
          token,
          customerName,
          customerPhone,
          notes: customer.notes,
          fulfillmentType: fulfillment.type,
          zoneId: fulfillment.type === "delivery" ? fulfillment.zoneId : null,
          deliveryAddress: fulfillment.type === "delivery" ? fulfillment.address : null,
          couponCode: couponCode.trim() || null,
          lines: cart.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        });
        setCart([]);
        setCustomer({ name: "", phone: "", notes: "" });
        setCouponCode("");
        setFulfillment((current) => ({ ...current, address: "" }));
        setPhoneConfirmNeeded(false);
        setLastOrder({ id: result.id, trackingPath: result.trackingPath });
        setCheckoutStep("success");
        toast.success(t("Thank you. Your order was sent successfully."));
      } catch (error) {
        toast.error(t(error instanceof Error ? error.message : "Could not send order"));
      }
    });
  }

  const isPremiumList = theme.slug === "antika" || theme.slug === "soul";
  const chipInactiveClass =
    theme.slug === "antika"
      ? "h-10 shrink-0 rounded-full border border-[#d7c7b2] bg-[#fffaf1] px-3 text-[#2a160f] hover:bg-[#f0dfc4]"
      : theme.slug === "soul"
        ? "h-10 shrink-0 rounded-full border border-[#d4af37]/25 bg-[#252018] px-3 text-[#f5f0e8] hover:bg-[#2a2520]"
        : theme.slug === "bistro"
          ? "h-10 shrink-0 rounded-full border border-[#c9a84c]/25 bg-[#1c1915] px-3 text-[#f5f0e8] hover:bg-[#252018]"
          : "h-10 shrink-0 rounded-full border bg-card/90 px-3";

  return (
    <div
      id="online-menu-items"
      className="pb-[calc(6rem+env(safe-area-inset-bottom))]"
      data-menu-layout={theme.layout}
      data-menu-theme={theme.slug}
    >
      <section
        className={[
          "sticky top-2 z-20 mb-5 border p-3 backdrop-blur",
          isPremiumList ? "rounded-none bg-card/95" : "rounded-3xl border-border/50 bg-card/98",
          theme.slug === "antika"
            ? "border-[#d7c7b2]"
            : theme.slug === "soul"
              ? "border-[#3d3528]"
              : theme.slug === "bistro"
                ? "border-[#3d3528]"
                : "border-border/50",
        ].join(" ")}
        style={{ boxShadow: "var(--mds-elevation-2)" }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("Search menu…")}
            className="h-11 rounded-2xl bg-background/80 ps-10"
            aria-label={t("Search menu")}
          />
        </div>

        {groups.length > 0 ? (
          <div className="-mx-3 mt-3 overflow-x-auto px-3 pb-1 scrollbar-none">
            <div className="flex w-max gap-2">
              <Button
                nativeButton={false}
                variant="default"
                size="sm"
                className="h-9 shrink-0 rounded-full px-4"
                render={<a href="#online-menu-items" />}
              >
                {t("All")}
              </Button>
              {visibleGroups.map((group) => (
                <Button
                  key={group.id}
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className={chipInactiveClass}
                  style={
                    isPremiumList || theme.slug === "bistro"
                      ? undefined
                      : {
                          borderColor: `${group.color}40`,
                          background: `linear-gradient(135deg, ${group.color}18, transparent)`,
                        }
                  }
                  render={<a href={`#menu-category-${group.id}`} />}
                >
                  <CategoryMark group={group} />
                  {group.name}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {lastOrder ? (
        <section className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
          <p className="font-semibold">{t("Thank you. We received your order.")}</p>
          <p className="mt-1 text-sm">
            {t("Tracking number")}: <span className="font-mono">{lastOrder.id.slice(0, 8)}</span>. {t("Track your order from the secure link.")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            nativeButton={false}
            render={<a href={lastOrder.trackingPath} />}
          >
            {t("Track order")}
          </Button>
        </section>
      ) : null}

      <div className="space-y-6">
        {groups.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border/70 bg-card/70 p-8 text-center text-muted-foreground">
            {t("No items are currently available on the menu.")}
          </section>
        ) : visibleGroups.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border/70 bg-card/70 p-8 text-center text-muted-foreground">
            {t("No results match")} <span className="font-medium">{searchQuery}</span>.
          </section>
        ) : (
          visibleGroups.map((group, groupIndex) => {
            const useThemedCategory =
              theme.slug === "antika" || theme.slug === "soul";
            const categoryBlockClass = useThemedCategory
              ? theme.slug === "antika"
                ? "antika-category-block space-y-2"
                : "soul-category-block space-y-2"
              : "space-y-3";
            const headingClass = useThemedCategory
              ? theme.slug === "antika"
                ? "antika-category-heading"
                : "soul-category-heading"
              : "flex items-center justify-between gap-3 rounded-3xl border border-border/40 bg-card/80 p-3";
            const titleClass = useThemedCategory
              ? theme.slug === "antika"
                ? "antika-section-title"
                : "soul-section-title"
              : "";
            const rowClass =
              theme.slug === "antika"
                ? "antika-product-row"
                : theme.slug === "soul"
                  ? "soul-product-row"
                  : theme.slug === "minimal"
                    ? "minimal-product-row"
                    : "";
            const priceClass =
              theme.slug === "antika"
                ? "antika-price"
                : theme.slug === "soul"
                  ? "soul-price"
                  : "";

            return (
            <section
              id={`menu-category-${group.id}`}
              key={group.id}
              className={`scroll-mt-28 ${categoryBlockClass}`}
            >
              <div
                className={headingClass}
                style={
                  useThemedCategory
                    ? undefined
                    : {
                        borderColor: `${group.color}30`,
                        background: `linear-gradient(135deg, ${group.color}1a, color-mix(in srgb, var(--card) 90%, transparent))`,
                        boxShadow: "var(--mds-elevation-1)",
                      }
                }
              >
                {useThemedCategory ? (
                  <h2 className={titleClass}>
                    <span>{group.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {group.items.length} {t("items")}
                    </span>
                  </h2>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryMark group={group} size="lg" />
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold font-heading">{group.name}</h2>
                        <p className="text-sm text-muted-foreground">{group.items.length} {t("items")}</p>
                      </div>
                    </div>
                    {normalizedSearchQuery ? (
                      <Badge variant="outline">{group.items.length} {t("results")}</Badge>
                    ) : null}
                  </>
                )}
              </div>

              {isListLayout ? (
                <div className="space-y-0">
                  {group.items.map((item, itemIndex) => {
                    const displayPrice = getMenuItemDisplayPrice(
                      item,
                      menu.organization.currency,
                      language
                    );
                    const eagerImage = groupIndex === 0 && itemIndex < 2;
                    const isPremiumRow = theme.slug === "antika" || theme.slug === "soul";
                    const showThumb = theme.showImages;
                    const thumbBorder =
                      theme.slug === "antika"
                        ? "border border-[#d7c7b2] bg-[#fffaf1]"
                        : theme.slug === "soul"
                          ? "border border-[#3d3528] bg-[#252018]"
                          : "rounded-xl bg-primary/10";
                    const leaderClass =
                      theme.slug === "antika"
                        ? "h-px min-w-8 flex-1 bg-[#2a160f]/35 transition-colors group-hover:bg-[#b67b31]"
                        : theme.slug === "soul"
                          ? "h-px min-w-8 flex-1 bg-[#d4af37]/25 transition-colors group-hover:bg-[#d4af37]"
                          : "h-px min-w-8 flex-1 bg-border";
                    const addBtnClass =
                      theme.slug === "antika"
                        ? "h-8 w-8 rounded-full bg-[#2a160f] p-0 text-[#f5eee3] hover:bg-[#b67b31]"
                        : theme.slug === "soul"
                          ? "h-8 w-8 rounded-full bg-[#d4af37] p-0 text-[#1c1915] hover:bg-[#e0c25a]"
                          : "h-8 w-8 rounded-full p-0";
                    const justAdded = recentlyAddedLineId === lineId(item.id, null);

                    return (
                      <article
                        key={item.id}
                        className={`group ${rowClass || "flex items-center gap-3 border-b border-border/50 py-3"}`}
                      >
                        {showThumb ? (
                          <div
                            className={`relative h-14 w-14 shrink-0 overflow-hidden sm:h-16 sm:w-16 ${thumbBorder}`}
                          >
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                fill
                                sizes="64px"
                                unoptimized
                                loading={eagerImage ? "eager" : "lazy"}
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <span className="flex size-full items-center justify-center text-lg font-bold text-primary/40">
                                {firstGrapheme(item.name)}
                              </span>
                            )}
                          </div>
                        ) : null}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold font-heading sm:text-base">
                                {item.name}
                                {item.isPopular ? (
                                  <span className="ms-2 text-xs font-normal text-primary">★</span>
                                ) : null}
                              </p>
                              {item.description ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                            {isPremiumRow ? <div className={leaderClass} /> : null}
                            <span
                              className={`font-price shrink-0 text-base tabular-nums ${priceClass} ${
                                theme.slug === "antika"
                                  ? "text-[#b67b31]"
                                  : theme.slug === "soul"
                                    ? "text-[#d4af37]"
                                    : "font-bold text-primary"
                              }`}
                            >
                              {formatCurrency(displayPrice.amount, menu.organization.currency)}
                            </span>
                          </div>

                          {item.variants.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.variants.map((variant) => {
                                const variantLineId = lineId(item.id, variant.id);
                                const wasJustAdded = recentlyAddedLineId === variantLineId;
                                return (
                                  <Button
                                    key={variant.id}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-full px-2.5 text-xs"
                                    data-added={wasJustAdded}
                                    disabled={!menu.store.canOrder}
                                    onClick={() => addToCart(item, variant)}
                                  >
                                    {variant.name} ·{" "}
                                    {formatCurrency(variant.price, menu.organization.currency)}
                                    {wasJustAdded ? (
                                      <Check className="size-3.5" />
                                    ) : (
                                      <Plus className="size-3.5" />
                                    )}
                                  </Button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>

                        {item.variants.length === 0 && menu.store.canOrder ? (
                          <Button
                            type="button"
                            size="sm"
                            className={addBtnClass}
                            onClick={() => addToCart(item)}
                            aria-label={t("Add to cart")}
                          >
                            {justAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
                          </Button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
                {group.items.map((item, itemIndex) => {
                  const displayPrice = getMenuItemDisplayPrice(
                    item,
                    menu.organization.currency,
                    language
                  );
                  const eagerImage = groupIndex === 0 && itemIndex < 2;

                  return (
                    <article
                      key={item.id}
                      className="group flex flex-col overflow-hidden rounded-3xl border border-border/40 bg-card transition hover:-translate-y-0.5"
                      style={{ boxShadow: "var(--mds-elevation-1)" }}
                    >
                      {theme.showImages ? (
                      <div className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden bg-primary/10">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="(min-width: 1024px) 33vw, 50vw"
                            unoptimized
                            loading={eagerImage ? "eager" : "lazy"}
                            className="object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="text-5xl font-bold text-primary/30 sm:text-6xl">
                            {firstGrapheme(item.name)}
                          </span>
                        )}
                        {item.imageUrl ? (
                          <span className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                        ) : null}
                        {item.isPopular ? (
                          <Badge variant="secondary" className="absolute start-2 top-2 rounded-full bg-background/90 shadow-sm backdrop-blur">
                            {t("Most ordered")}
                          </Badge>
                        ) : null}
                      </div>
                      ) : null}

                      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-2.5 sm:gap-3 sm:p-4">
                        <div className="grid gap-2">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-semibold leading-snug font-heading sm:text-base">{item.name}</h3>
                            {item.description ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="w-fit rounded-2xl bg-primary/10 px-2.5 py-2 text-start sm:px-3">
                            {displayPrice.label ? (
                              <p className="text-xs text-primary/80">{displayPrice.label}</p>
                            ) : null}
                            <p className="font-price text-sm font-bold tabular-nums text-primary sm:text-base">
                              {formatCurrency(displayPrice.amount, menu.organization.currency)}
                              {displayPrice.range ? (
                                <span className="ms-1 text-[11px] font-normal text-muted-foreground sm:text-xs">
                                  {displayPrice.range}
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>

                        {item.variants.length > 0 ? (
                          <div className="mt-auto grid gap-2">
                            <p className="text-xs font-medium text-muted-foreground">{t("Choose size")}</p>
                            {item.variants.map((variant) => {
                              const variantLineId = lineId(item.id, variant.id);
                              const wasJustAdded = recentlyAddedLineId === variantLineId;

                              return (
                                <Button
                                  key={variant.id}
                                  type="button"
                                  variant="outline"
                                  className="h-auto flex-col items-stretch gap-2 rounded-2xl border-border/40 bg-background/60 px-2 py-2 text-start hover:border-primary/40 hover:bg-primary/5 data-[added=true]:border-primary/50 data-[added=true]:bg-primary/10 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2.5"
                                  data-added={wasJustAdded}
                                  disabled={!menu.store.canOrder}
                                  onClick={() => addToCart(item, variant)}
                                >
                                  <span className="min-w-0 truncate font-medium">{variant.name}</span>
                                  <span className="flex shrink-0 items-center justify-between gap-1.5 sm:justify-end sm:gap-2">
                                    <span className="font-price rounded-full bg-muted px-2 py-1 text-[11px] font-semibold tabular-nums sm:px-2.5 sm:text-xs">
                                      {formatCurrency(variant.price, menu.organization.currency)}
                                    </span>
                                    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground sm:px-2.5">
                                      {wasJustAdded ? (
                                        <>
                                          <Check className="size-3.5" />
                                          {t("Added")}
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="size-3.5" />
                                          {t("Add")}
                                        </>
                                      )}
                                    </span>
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            className="mt-auto h-10 w-full rounded-2xl text-sm font-semibold sm:h-11 sm:text-base"
                            disabled={!menu.store.canOrder}
                            onClick={() => addToCart(item)}
                          >
                            {recentlyAddedLineId === lineId(item.id, null) ? (
                              <>
                                <Check className="size-4" />
                                {t("Added")}
                              </>
                            ) : (
                              <>
                                <Plus className="size-4" />
                                {t("Add to order")}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              )}
            </section>
            );
          })
        )}
      </div>

      <Dialog
        open={isCartOpen}
        onOpenChange={(open) => {
          if (open) setIsCartOpen(true);
          else closeCart();
        }}
      >
        <DialogContent className="bottom-0 top-auto left-1/2 flex h-[92dvh] max-h-[92dvh] max-w-none translate-y-0 flex-col overflow-hidden rounded-b-none rounded-t-3xl p-0 sm:max-w-2xl lg:h-[min(90dvh,760px)]">
          <DialogHeader className="shrink-0 border-b border-border/40 px-4 pb-3 pt-3 sm:px-5">
            <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-muted-foreground/25" />
            <DialogTitle className="flex items-center justify-between gap-3 pe-8">
              <span className="flex items-center gap-2">
                <span
                  className={`flex size-10 items-center justify-center rounded-2xl ${
                    checkoutStep === "success"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {checkoutStep === "success" ? (
                    <Check className="size-5" />
                  ) : checkoutStep === "review" ? (
                    <ShoppingBag className="size-5" />
                  ) : (
                    <UserRound className="size-5" />
                  )}
                </span>
                <span className="block">
                  {checkoutStep === "review"
                    ? t("Your order")
                    : checkoutStep === "details"
                      ? t("Contact details")
                      : t("Order sent")}
                </span>
              </span>
              {checkoutStep !== "success" ? (
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline" className="rounded-full">
                    {checkoutStep === "review" ? t("1 of 2") : t("2 of 2")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{cartItemCount} {t("items")}</span>
                </div>
              ) : null}
            </DialogTitle>
            <DialogDescription className="text-start text-sm text-muted-foreground">
              {checkoutStep === "review"
                ? t("Review items and fulfillment method")
                : checkoutStep === "details"
                  ? t("Complete your details to send the order")
                  : t("Keep the tracking link")}
            </DialogDescription>
          </DialogHeader>

          {checkoutStep === "success" && lastOrder ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 text-center sm:px-6">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                  <Check className="size-8" />
                </div>
                <p className="text-lg font-semibold">{t("Thank you. We received your order.")}</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  {t("Tracking number")}:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {lastOrder.id.slice(0, 8)}
                  </span>
                  . {t("Track your order from the secure link.")}
                </p>
                <Button
                  type="button"
                  className="mt-6 h-12 w-full max-w-sm rounded-2xl text-base font-semibold"
                  nativeButton={false}
                  render={<a href={lastOrder.trackingPath} />}
                >
                  {t("Track order")}
                </Button>
              </div>
              <div className="shrink-0 border-t border-border/40 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-2xl"
                  onClick={closeCart}
                >
                  {t("Back to menu")}
                </Button>
              </div>
            </>
          ) : null}

          {checkoutStep === "review" ? (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
                {cart.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/30 px-4 py-10 text-center">
                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-background text-primary">
                      <ShoppingBag className="size-6" />
                    </div>
                    <p className="text-sm font-medium">{t("Cart is empty")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("Choose products to add to your order.")}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {cart.map((line) => (
                      <li
                        key={line.id}
                        className="rounded-2xl border border-border/40 bg-muted/25 p-3"
                      >
                        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                          <div className="min-w-0 pe-1">
                            <p className="line-clamp-2 text-sm font-semibold leading-snug font-heading sm:text-base">
                              {line.name}
                            </p>
                            {line.variantName ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">{line.variantName}</p>
                            ) : null}
                            <p className="font-price mt-1 text-xs text-muted-foreground">
                              {formatCurrency(line.unitPrice, menu.organization.currency)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-8 rounded-xl text-muted-foreground hover:text-destructive"
                            aria-label={`${t("Delete")} ${line.name}`}
                            onClick={() => updateQuantity(line.id, 0)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center rounded-2xl border border-border/40 bg-background p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-8 rounded-xl"
                              aria-label={`${t("Decrease quantity")} ${line.name}`}
                              onClick={() => updateQuantity(line.id, line.quantity - 1)}
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span
                              className="w-9 text-center text-sm font-semibold tabular-nums"
                              aria-label={`${t("Quantity")} ${line.name}`}
                            >
                              {line.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-8 rounded-xl"
                              aria-label={`${t("Increase quantity")} ${line.name}`}
                              onClick={() => updateQuantity(line.id, line.quantity + 1)}
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </div>
                          <p className="font-price shrink-0 text-base font-bold tabular-nums text-primary">
                            {formatCurrency(
                              line.unitPrice * line.quantity,
                              menu.organization.currency
                            )}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {menu.store.canOrder &&
                cart.length > 0 &&
                (fulfillmentConfig.pickupEnabled || fulfillmentConfig.deliveryEnabled) ? (
                  <div className="grid gap-2 rounded-2xl border border-border/50 p-3">
                    <p className="text-sm font-semibold">{t("Fulfillment method")}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {fulfillmentConfig.pickupEnabled ? (
                        <Button
                          type="button"
                          variant={fulfillment.type === "pickup" ? "default" : "outline"}
                          className="h-10 rounded-xl"
                          onClick={() =>
                            setFulfillment((current) => ({ ...current, type: "pickup" }))
                          }
                        >
                          {t("Store pickup")}
                        </Button>
                      ) : null}
                      {fulfillmentConfig.deliveryEnabled ? (
                        <Button
                          type="button"
                          variant={fulfillment.type === "delivery" ? "default" : "outline"}
                          className="h-10 rounded-xl"
                          onClick={() =>
                            setFulfillment((current) => ({
                              ...current,
                              type: "delivery",
                              zoneId: current.zoneId || fulfillmentConfig.zones[0]?.id || "",
                            }))
                          }
                        >
                          {t("Delivery")}
                        </Button>
                      ) : null}
                    </div>
                    {fulfillment.type === "delivery" ? (
                      <div className="grid gap-2 pt-1">
                        <label className="grid gap-1 text-sm">
                          <span className="text-muted-foreground">{t("Delivery zone")}</span>
                          <select
                            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                            value={fulfillment.zoneId}
                            onChange={(event) =>
                              setFulfillment((current) => ({
                                ...current,
                                zoneId: event.target.value,
                              }))
                            }
                            aria-label={t("Delivery zone")}
                          >
                            {fulfillmentConfig.zones.map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name} —{" "}
                                {formatCurrency(zone.fee, menu.organization.currency)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-muted-foreground">{t("Delivery address")}</span>
                          <Textarea
                            value={fulfillment.address}
                            onChange={(event) =>
                              setFulfillment((current) => ({
                                ...current,
                                address: event.target.value,
                              }))
                            }
                            placeholder={t("Street, building, landmark")}
                            className="min-h-16 rounded-xl"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 space-y-3 border-t border-border/40 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-start"
                  onClick={() => setCartDetailsOpen((open) => !open)}
                  aria-expanded={cartDetailsOpen}
                  aria-label={t("Total details")}
                >
                  <span>
                    <span className="block text-sm font-medium text-primary/80">
                      {t("Final total")}
                    </span>
                    <span className="font-price block text-2xl font-bold tabular-nums text-primary">
                      {formatCurrency(orderTotal, menu.organization.currency)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-primary/80">
                    {cartItemCount} {t("items")}
                    <ChevronDown
                      className={`size-4 transition ${cartDetailsOpen ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>

                {cartDetailsOpen ? (
                  <div className="grid gap-1 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{t("Items subtotal")}</span>
                      <span className="tabular-nums">
                        {formatCurrency(subtotal, menu.organization.currency)}
                      </span>
                    </div>
                    {deliveryFee > 0 ? (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>{t("Delivery fee")}</span>
                        <span className="tabular-nums">
                          {formatCurrency(deliveryFee, menu.organization.currency)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {menu.store.canOrder ? (
                  <Button
                    type="button"
                    className="h-12 w-full rounded-2xl text-base font-semibold"
                    disabled={cart.length === 0}
                    onClick={goToCheckoutDetails}
                  >
                    {t("Confirm and continue")}
                  </Button>
                ) : (
                  <p className="rounded-2xl bg-amber-50 p-3 text-center text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
                    {menu.store.availability.messageAr}
                  </p>
                )}
              </div>
            </>
          ) : null}

          {checkoutStep === "details" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                <div className="mb-3 rounded-2xl border border-border/40 bg-muted/25 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{t("Quick summary")}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {cartItemCount} {t("items")} ·{" "}
                        {fulfillment.type === "delivery" ? t("Delivery") : t("Store pickup")}
                      </p>
                    </div>
                    <p className="font-price text-base font-bold tabular-nums text-primary">
                      {formatCurrency(orderTotal, menu.organization.currency)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 px-0 text-primary"
                    onClick={() => {
                      setPhoneConfirmNeeded(false);
                      setCustomerPrompt(null);
                      setCheckoutStep("review");
                    }}
                  >
                    {t("Edit items or fulfillment")}
                  </Button>
                </div>

                {customerPrompt ? (
                  <p
                    role="alert"
                    className="mb-3 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-medium text-primary"
                  >
                    {customerPrompt}
                  </p>
                ) : null}

                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">{t("Name")}</span>
                    <Input
                      value={customer.name}
                      onChange={(event) => {
                        setCustomer((current) => ({ ...current, name: event.target.value }));
                        setCustomerPrompt(null);
                      }}
                      placeholder={t("Your name")}
                      aria-invalid={customerPrompt !== null && !customer.name.trim()}
                      className="h-11 rounded-xl"
                      autoComplete="name"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      {t("Phone number")}{" "}
                      <span className="font-normal text-muted-foreground">({t("Optional")})</span>
                    </span>
                    <Input
                      ref={phoneInputRef}
                      value={customer.phone}
                      onChange={(event) => {
                        setCustomer((current) => ({ ...current, phone: event.target.value }));
                        setCustomerPrompt(null);
                        if (event.target.value.trim()) setPhoneConfirmNeeded(false);
                      }}
                      placeholder={t("Example: 01xxxxxxxxx")}
                      inputMode="tel"
                      aria-invalid={
                        customerPrompt !== null &&
                        Boolean(customer.phone.trim()) &&
                        customer.phone.trim().length < 5
                      }
                      className="h-11 rounded-xl"
                      autoComplete="tel"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      {t("Coupon code")}{" "}
                      <span className="font-normal text-muted-foreground">({t("Optional")})</span>
                    </span>
                    <Input
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value)}
                      placeholder={t("Enter code if available")}
                      className="h-11 rounded-xl uppercase"
                      autoCapitalize="characters"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      {t("Order notes")}{" "}
                      <span className="font-normal text-muted-foreground">({t("Optional")})</span>
                    </span>
                    <Textarea
                      value={customer.notes}
                      onChange={(event) =>
                        setCustomer((current) => ({ ...current, notes: event.target.value }))
                      }
                      placeholder={t("Any extra order details")}
                      className="min-h-24 rounded-xl"
                    />
                  </label>
                </div>
              </div>

              <div className="shrink-0 space-y-2 border-t border-border/40 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
                {phoneConfirmNeeded && !customer.phone.trim() ? (
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      className="h-12 rounded-2xl text-base font-semibold"
                      disabled={isPending || !customer.name.trim() || cart.length === 0}
                      onClick={() => submitOrder({ allowNameOnly: true })}
                    >
                      {isPending ? t("Sending…") : t("Send with name only")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-2xl"
                      disabled={isPending}
                      onClick={() => {
                        setPhoneConfirmNeeded(false);
                        setCustomerPrompt(
                          t("Add a phone number if you want order confirmation, then send the order.")
                        );
                        window.setTimeout(() => phoneInputRef.current?.focus(), 0);
                      }}
                    >
                      {t("Add phone number")}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-2xl px-4"
                      disabled={isPending}
                      onClick={() => {
                        setPhoneConfirmNeeded(false);
                        setCustomerPrompt(null);
                        setCheckoutStep("review");
                      }}
                    >
                      {t("Back")}
                    </Button>
                    <Button
                      type="button"
                      className="h-12 rounded-2xl text-base font-semibold"
                      disabled={isPending || cart.length === 0}
                      onClick={() => submitOrder()}
                    >
                      {isPending ? t("Sending…") : t("Send order")}
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <div
        className={[
          "fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur",
          theme.slug === "antika"
            ? "border-[#b67b31]/40 bg-[#2a160f]/95 text-[#f5eee3]"
            : theme.slug === "soul"
              ? "border-[#d4af37]/30 bg-[#1c1915]/95 text-[#f5f0e8]"
              : theme.slug === "bistro"
                ? "border-[#c9a84c]/25 bg-[#141210]/95 text-[#f5f0e8]"
                : "border-border/40 bg-background/97",
        ].join(" ")}
        style={{ boxShadow: "var(--mds-elevation-3)" }}
      >
        <div
          className={[
            "mx-auto flex items-center gap-3 rounded-3xl border p-2",
            isPremiumList || theme.slug === "bistro" ? "max-w-5xl" : "max-w-4xl",
            theme.slug === "antika"
              ? "border-[#b67b31]/30 bg-[#3a2418]/80"
              : theme.slug === "soul" || theme.slug === "bistro"
                ? "border-[#d4af37]/20 bg-[#252018]/90"
                : "border-border/40 bg-card",
          ].join(" ")}
          style={{ boxShadow: "var(--mds-elevation-1)" }}
        >
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition ${
              recentlyAddedLineId ? "scale-110 bg-primary text-primary-foreground" : ""
            }`}
          >
            <ShoppingBag className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("Cart")}</p>
            {cart.length > 0 ? (
              <p className="truncate text-sm text-muted-foreground">
                <span className="font-bold tabular-nums text-foreground">{cartItemCount}</span> {t("items")} ·{" "}
                <span className="font-price font-bold tabular-nums text-primary">
                  {formatCurrency(orderTotal, menu.organization.currency)}
                </span>
              </p>
            ) : lastOrder ? (
              <p className="truncate text-sm text-muted-foreground">{t("Order sent · open to track")}</p>
            ) : (
              <p className="truncate text-sm text-muted-foreground">{t("Add products to your order")}</p>
            )}
          </div>
          <Button
            type="button"
            className={[
              "h-12 rounded-2xl px-5 text-base font-semibold",
              theme.slug === "soul" || theme.slug === "bistro"
                ? "bg-[#d4af37] text-[#1c1915] hover:bg-[#e0c25a]"
                : theme.slug === "antika"
                  ? "bg-[#b67b31] text-[#fffaf1] hover:bg-[#c48a3d]"
                  : "",
            ].join(" ")}
            disabled={!menu.store.canOrder && cart.length === 0 && !lastOrder}
            onClick={openCartFromBar}
          >
            {cart.length > 0
              ? t("Review order")
              : lastOrder
                ? t("Track last order")
                : t("Open cart")}
          </Button>
        </div>
      </div>
    </div>
  );
}
