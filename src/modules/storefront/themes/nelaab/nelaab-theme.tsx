"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  CircleUserRound,
  Heart,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { submitStorefrontCheckoutAction } from "../../actions/storefront-checkout.actions";
import {
  StorefrontCartProvider,
  useStorefrontCart,
} from "../../components/storefront-cart-provider";
import { StorefrontCustomerAuth } from "../../components/storefront-customer-auth";
import { NelaabAccountPage, NelaabLoginPage } from "./nelaab-customer-pages";
import {
  STOREFRONT_ORDER_STATUSES,
  STOREFRONT_ORDER_STATUS_LABELS_AR,
  type StorefrontOrderStatus,
} from "../../core/order-lifecycle";
import {
  storefrontTokenStyle,
  type StorefrontProduct,
  type StorefrontThemeDefinition,
  type StorefrontThemePageProps,
} from "../../core/types";
import { buildStorefrontPath } from "../../core/urls";

const tokens = {
  colors: {
    background: "#FFF7E6",
    surface: "#FFFFFF",
    primary: "#482AD6",
    primaryForeground: "#FFFFFF",
    accent: "#FFD32A",
    accentForeground: "#1A1A2E",
    danger: "#FF4D46",
    success: "#00A99D",
    text: "#1A1A2E",
    mutedText: "#6B6B7B",
    border: "#E8E3DA",
  },
  fonts: {
    heading: "var(--font-cairo), Cairo, sans-serif",
    body: "var(--font-cairo), Cairo, sans-serif",
  },
  radius: { card: "20px", control: "14px", hero: "32px" },
  shadow: {
    card: "0 4px 18px rgba(26,26,46,.06)",
    hover: "0 10px 30px rgba(72,42,214,.12)",
    overlay: "0 24px 70px rgba(26,26,46,.18)",
  },
  motion: { fast: "120ms", normal: "200ms", slow: "300ms" },
} as const;

function orderStatusLabel(status: string) {
  return STOREFRONT_ORDER_STATUSES.includes(status as StorefrontOrderStatus)
    ? STOREFRONT_ORDER_STATUS_LABELS_AR[status as StorefrontOrderStatus]
    : status;
}

function paymentStatusLabel(status: string) {
  return (
    (
      {
        pending: "الدفع عند الاستلام",
        paid: "تم الدفع",
        failed: "لم يتم الدفع",
        refunded: "تم رد المبلغ",
        partially_refunded: "تم رد جزء من المبلغ",
        authorized: "تم تفويض الدفع",
      } as Record<string, string>
    )[status] ?? status
  );
}

function ProductImage({
  product,
  priority = false,
}: {
  product: StorefrontProduct;
  priority?: boolean;
}) {
  return product.imageUrl ? (
    <Image
      src={product.imageUrl}
      alt={product.name}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      className="object-cover transition duration-300 group-hover:scale-[1.03]"
      priority={priority}
      unoptimized
    />
  ) : (
    <div
      className="flex size-full items-center justify-center bg-[linear-gradient(135deg,#f1edff,#fff1c2)] text-5xl"
      aria-label="لا توجد صورة"
    >
      🧸
    </div>
  );
}

function Header({ storefront }: StorefrontThemePageProps) {
  const cart = useStorefrontCart();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--sf-border)] bg-[color:var(--sf-surface)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link
          href={buildStorefrontPath(storefront)}
          className="flex min-w-0 items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--sf-primary)]"
        >
          {storefront.brand.logoUrl ? (
            <Image
              src={storefront.brand.logoUrl}
              alt=""
              width={44}
              height={44}
              className="size-11 rounded-xl object-contain"
              unoptimized
            />
          ) : (
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--sf-primary)] text-xl text-white">
              ن
            </span>
          )}
          <strong className="truncate text-xl font-extrabold text-[var(--sf-primary)] sm:text-2xl">
            {storefront.brand.name}
          </strong>
        </Link>
        <nav
          className="ms-auto hidden items-center gap-6 text-sm font-bold md:flex"
          aria-label="التنقل الرئيسي"
        >
          <Link
            href={buildStorefrontPath(storefront, "/shop")}
            className="hover:text-[var(--sf-primary)]"
          >
            كل الألعاب
          </Link>
          <Link
            href={buildStorefrontPath(storefront, "/search")}
            className="hover:text-[var(--sf-primary)]"
          >
            البحث
          </Link>
        </nav>
        <Link
          aria-label="البحث"
          href={buildStorefrontPath(storefront, "/search")}
          className="ms-auto grid size-11 place-items-center rounded-[var(--sf-control-radius)] border border-[var(--sf-border)] md:ms-0"
        >
          <Search className="size-5" />
        </Link>
        <Link
          aria-label="حسابي"
          href={buildStorefrontPath(storefront, "/account")}
          className="grid size-11 place-items-center rounded-[var(--sf-control-radius)] border border-[var(--sf-border)]"
        >
          <CircleUserRound className="size-5" />
        </Link>
        <Link
          aria-label={`السلة، ${cart.count} منتجات`}
          href={buildStorefrontPath(storefront, "/cart")}
          className="relative grid size-11 place-items-center rounded-[var(--sf-control-radius)] bg-[var(--sf-accent)] text-[var(--sf-accent-fg)]"
        >
          <ShoppingBag className="size-5" />
          {cart.count > 0 ? (
            <span className="absolute -end-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-[var(--sf-danger)] px-1 text-[10px] font-bold text-white">
              {cart.count}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}

function Shell({
  storefront,
  children,
}: {
  storefront: StorefrontThemePageProps["storefront"];
  children: React.ReactNode;
}) {
  return (
    <StorefrontCartProvider storeSlug={storefront.slug}>
      <div
        data-storefront-theme="nelaab"
        dir="rtl"
        style={storefrontTokenStyle(tokens)}
        className="min-h-dvh bg-[var(--sf-bg)] font-[family-name:var(--sf-font-body)] text-[var(--sf-text)]"
      >
        <Header storefront={storefront} />
        {!storefront.canOrder ? (
          <div
            role="status"
            className="bg-[var(--sf-danger)] px-4 py-2 text-center text-sm font-bold text-white"
          >
            {storefront.unavailableMessage ?? "الطلب غير متاح حاليًا"}
          </div>
        ) : null}
        {children}
        <footer className="mt-16 bg-[var(--sf-primary)] px-4 py-10 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-extrabold">{storefront.brand.name}</p>
              <p className="mt-1 text-sm text-white/75">
                {storefront.brand.tagline}
              </p>
            </div>
            <p className="text-sm text-white/70">تجربة متجر مدعومة من Velora</p>
          </div>
        </footer>
      </div>
    </StorefrontCartProvider>
  );
}

function ProductCard({
  storefront,
  product,
  priority,
}: {
  storefront: StorefrontThemePageProps["storefront"];
  product: StorefrontProduct;
  priority?: boolean;
}) {
  const { add } = useStorefrontCart();
  const needsChoice = product.variants.length > 0;
  return (
    <article className="group relative overflow-hidden rounded-[var(--sf-card-radius)] border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-[var(--sf-card-shadow)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--sf-hover-shadow)]">
      <Link
        href={buildStorefrontPath(storefront, `/product/${product.slug}`)}
        className="block focus-visible:outline-2 focus-visible:outline-[var(--sf-primary)]"
      >
        <div className="relative aspect-square overflow-hidden">
          <ProductImage product={product} priority={priority} />
        </div>
        <div className="p-3 sm:p-4">
          {product.attributes.age_range &&
          typeof product.attributes.age_range === "object" &&
          !Array.isArray(product.attributes.age_range) ? (
            <span className="mb-2 inline-flex rounded-full bg-[#FFF0EF] px-2 py-1 text-[11px] font-bold text-[var(--sf-danger)]">
              من {product.attributes.age_range.min} إلى{" "}
              {product.attributes.age_range.max} سنوات
            </span>
          ) : null}
          <h3 className="line-clamp-2 min-h-12 font-bold leading-6">
            {product.name}
          </h3>
          <p className="mt-2 font-extrabold text-[var(--sf-primary)]">
            {formatCurrency(product.price, storefront.currency)}
          </p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => (needsChoice ? undefined : add(product))}
        disabled={!product.available || !storefront.canOrder}
        aria-label={
          needsChoice
            ? `اختر خيارات ${product.name}`
            : `أضف ${product.name} للسلة`
        }
        className="m-3 mt-0 flex h-11 w-[calc(100%-1.5rem)] items-center justify-center rounded-[var(--sf-control-radius)] bg-[var(--sf-accent)] px-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50 sm:m-4 sm:mt-0 sm:w-[calc(100%-2rem)]"
      >
        {needsChoice ? (
          <Link
            href={buildStorefrontPath(storefront, `/product/${product.slug}`)}
          >
            اختر الخيارات
          </Link>
        ) : (
          "أضف للسلة"
        )}
      </button>
    </article>
  );
}

function ProductGrid({
  storefront,
  products,
}: {
  storefront: StorefrontThemePageProps["storefront"];
  products: StorefrontProduct[];
}) {
  if (!products.length)
    return (
      <div className="rounded-3xl border border-dashed border-[var(--sf-border)] bg-white p-10 text-center">
        <span className="text-5xl">🪁</span>
        <h2 className="mt-4 text-xl font-extrabold">مفيش ألعاب هنا لسه</h2>
        <p className="mt-2 text-[var(--sf-muted)]">
          جرّب قسم تاني أو ارجع لاحقًا.
        </p>
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          storefront={storefront}
          product={product}
          priority={index < 2}
        />
      ))}
    </div>
  );
}

function Home({ storefront }: StorefrontThemePageProps) {
  const featured = storefront.products.filter((p) => p.isFeatured).slice(0, 8);
  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <div className="relative overflow-hidden rounded-[var(--sf-hero-radius)] bg-[var(--sf-primary)] px-6 py-12 text-white sm:px-10 sm:py-16 lg:min-h-[440px] lg:px-16 lg:py-20">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-bold">
              <Sparkles className="size-4 text-[var(--sf-accent)]" /> لعب أكثر،
              تعلّم أفضل
            </span>
            <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              {storefront.content.heroTitle}
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-white/80">
              {storefront.content.heroSubtitle}
            </p>
            <Link
              href={buildStorefrontPath(storefront, "/shop")}
              className="mt-7 inline-flex h-13 items-center gap-2 rounded-[var(--sf-control-radius)] bg-[var(--sf-accent)] px-6 font-extrabold text-[var(--sf-accent-fg)]"
            >
              {storefront.content.heroCtaLabel}
              <ArrowLeft className="size-5" />
            </Link>
          </div>
          <div
            className="absolute -bottom-16 -left-12 size-64 rounded-full bg-[var(--sf-accent)]/90 blur-sm"
            aria-hidden
          />
          <div
            className="absolute -left-4 top-8 text-8xl opacity-90 sm:text-9xl"
            aria-hidden
          >
            🧩
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="font-bold text-[var(--sf-primary)]">
              اختار حسب اهتمامه
            </p>
            <h2 className="text-2xl font-black sm:text-3xl">الأقسام</h2>
          </div>
          <Link
            href={buildStorefrontPath(storefront, "/shop")}
            className="text-sm font-bold text-[var(--sf-primary)]"
          >
            عرض الكل
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {storefront.categories.slice(0, 6).map((category) => (
            <Link
              key={category.id}
              href={buildStorefrontPath(
                storefront,
                `/category/${category.slug}`,
              )}
              className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-[var(--sf-border)] bg-white p-3 text-center shadow-[var(--sf-card-shadow)] transition hover:-translate-y-0.5"
            >
              <span className="text-3xl" aria-hidden>
                {category.icon || "🎲"}
              </span>
              <strong className="mt-2 text-sm">{category.name}</strong>
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-black sm:text-3xl">
          {storefront.content.featuredTitle}
        </h2>
        <ProductGrid
          storefront={storefront}
          products={(featured.length ? featured : storefront.products).slice(
            0,
            8,
          )}
        />
      </section>
      <section className="mx-auto grid max-w-7xl gap-3 px-4 py-14 sm:grid-cols-3 sm:px-6 lg:px-8">
        {[
          [Truck, "توصيل موثوق", "طلبك يوصل بأمان"],
          [Star, "اختيارات مدروسة", "ألعاب مناسبة لكل مرحلة"],
          [Heart, "تجربة أسهل", "من الاختيار لحد الاستلام"],
        ].map(([Icon, title, copy]) => {
          const C = Icon as typeof Truck;
          return (
            <div
              key={String(title)}
              className="flex gap-3 rounded-2xl bg-white p-5"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#F1EDFF] text-[var(--sf-primary)]">
                <C className="size-6" />
              </span>
              <div>
                <h3 className="font-extrabold">{title as string}</h3>
                <p className="mt-1 text-sm text-[var(--sf-muted)]">
                  {copy as string}
                </p>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function Listing({ storefront, categorySlug }: StorefrontThemePageProps) {
  const category = categorySlug
    ? storefront.categories.find((c) => c.slug === categorySlug)
    : null;
  const products = category
    ? storefront.products.filter((p) => p.categoryId === category.id)
    : storefront.products;
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-[var(--sf-primary)]">
        {category ? "قسم" : "المتجر"}
      </p>
      <h1 className="mt-1 text-3xl font-black sm:text-4xl">
        {category?.name ?? "كل الألعاب"}
      </h1>
      <p className="mb-8 mt-2 text-[var(--sf-muted)]">{products.length} منتج</p>
      <ProductGrid storefront={storefront} products={products} />
    </main>
  );
}

function SearchPage({ storefront, query = "" }: StorefrontThemePageProps) {
  const normalized = query.trim().toLocaleLowerCase("ar");
  const products = normalized
    ? storefront.products.filter((p) =>
        `${p.name} ${p.description}`
          .toLocaleLowerCase("ar")
          .includes(normalized),
      )
    : storefront.products;
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-black">دور على لعبتك</h1>
      <form
        action={buildStorefrontPath(storefront, "/search")}
        className="my-6 flex max-w-2xl gap-2"
      >
        {storefront.previewToken ? (
          <input type="hidden" name="preview" value={storefront.previewToken} />
        ) : null}
        {storefront.token ? (
          <input type="hidden" name="token" value={storefront.token} />
        ) : null}
        <label className="sr-only" htmlFor="store-search">
          كلمة البحث
        </label>
        <input
          id="store-search"
          name="q"
          defaultValue={query}
          placeholder="اسم اللعبة أو الفئة..."
          className="h-13 min-w-0 flex-1 rounded-[var(--sf-control-radius)] border border-[var(--sf-border)] bg-white px-4 outline-none focus:border-[var(--sf-primary)] focus:ring-3 focus:ring-[#482AD6]/15"
        />
        <button className="h-13 rounded-[var(--sf-control-radius)] bg-[var(--sf-primary)] px-5 font-bold text-white">
          بحث
        </button>
      </form>
      <ProductGrid storefront={storefront} products={products} />
    </main>
  );
}

function ProductPage({ storefront, productSlug }: StorefrontThemePageProps) {
  const product = storefront.products.find((p) => p.slug === productSlug);
  const [variantId, setVariantId] = useState(product?.variants[0]?.id ?? "");
  const { add } = useStorefrontCart();
  if (!product) return <NotFound storefront={storefront} />;
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2 lg:px-8 lg:gap-14">
      <div className="relative aspect-square overflow-hidden rounded-[var(--sf-hero-radius)] bg-white">
        <ProductImage product={product} priority />
      </div>
      <div className="self-center">
        <p className="font-bold text-[var(--sf-primary)]">
          {storefront.categories.find((c) => c.id === product.categoryId)
            ?.name ?? "لعبة"}
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
          {product.name}
        </h1>
        <p className="mt-5 text-2xl font-black text-[var(--sf-primary)]">
          {formatCurrency(variant?.price ?? product.price, storefront.currency)}
        </p>
        <p className="mt-5 whitespace-pre-line leading-8 text-[var(--sf-muted)]">
          {product.description || "لعبة ممتعة مختارة بعناية."}
        </p>
        {product.specifications.length ? (
          <dl className="mt-6 divide-y divide-[var(--sf-border)] rounded-2xl border border-[var(--sf-border)] bg-white px-4">
            {product.specifications.map((specification) => (
              <div
                key={`${specification.name}:${specification.value}`}
                className="grid grid-cols-2 gap-3 py-3 text-sm"
              >
                <dt className="font-bold text-[var(--sf-muted)]">
                  {specification.name}
                </dt>
                <dd className="font-extrabold">{specification.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {product.variants.length ? (
          <fieldset className="mt-6">
            <legend className="mb-3 font-extrabold">اختار النوع</legend>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  disabled={!v.available}
                  className={`min-h-11 rounded-xl border px-4 font-bold ${variantId === v.id ? "border-[var(--sf-primary)] bg-[#F1EDFF] text-[var(--sf-primary)]" : "border-[var(--sf-border)] bg-white"}`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <button
          type="button"
          disabled={
            !storefront.canOrder ||
            !product.available ||
            (product.variants.length > 0 && !variant)
          }
          onClick={() => add(product, variant)}
          className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-[var(--sf-control-radius)] bg-[var(--sf-accent)] text-lg font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingBag className="size-5" />
          أضف للسلة
        </button>
      </div>
    </main>
  );
}

function CartPage({ storefront }: StorefrontThemePageProps) {
  const cart = useStorefrontCart();
  if (!cart.hydrated)
    return (
      <main className="mx-auto min-h-96 max-w-5xl animate-pulse px-4 py-10">
        <div className="h-10 w-40 rounded-xl bg-black/10" />
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black">سلة التسوق</h1>
      {cart.lines.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-white p-10 text-center">
          <ShoppingBag className="mx-auto size-12 text-[var(--sf-primary)]" />
          <h2 className="mt-4 text-xl font-black">السلة فاضية</h2>
          <Link
            href={buildStorefrontPath(storefront, "/shop")}
            className="mt-5 inline-flex h-12 items-center rounded-xl bg-[var(--sf-accent)] px-5 font-bold"
          >
            ابدأ التسوق
          </Link>
        </div>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {cart.lines.map((line) => (
              <article
                key={line.id}
                className="flex gap-3 rounded-2xl bg-white p-3 sm:p-4"
              >
                {line.imageUrl ? (
                  <Image
                    src={line.imageUrl}
                    alt=""
                    width={96}
                    height={96}
                    className="size-24 rounded-xl object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="grid size-24 shrink-0 place-items-center rounded-xl bg-[#F1EDFF] text-3xl">
                    🧸
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold">{line.name}</h2>
                  {line.variantName ? (
                    <p className="text-sm text-[var(--sf-muted)]">
                      {line.variantName}
                    </p>
                  ) : null}
                  <p className="mt-2 font-bold text-[var(--sf-primary)]">
                    {formatCurrency(line.unitPrice, storefront.currency)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      aria-label="تقليل الكمية"
                      onClick={() =>
                        cart.setQuantity(line.id, line.quantity - 1)
                      }
                      className="grid size-9 place-items-center rounded-lg border border-[var(--sf-border)]"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-6 text-center font-bold">
                      {line.quantity}
                    </span>
                    <button
                      aria-label="زيادة الكمية"
                      onClick={() =>
                        cart.setQuantity(line.id, line.quantity + 1)
                      }
                      className="grid size-9 place-items-center rounded-lg border border-[var(--sf-border)]"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <aside className="h-fit rounded-2xl bg-white p-5">
            <h2 className="text-xl font-black">ملخص الطلب</h2>
            <div className="my-5 flex justify-between border-b border-[var(--sf-border)] pb-5">
              <span>الإجمالي المبدئي</span>
              <strong>
                {formatCurrency(cart.subtotal, storefront.currency)}
              </strong>
            </div>
            <Link
              href={buildStorefrontPath(storefront, "/checkout")}
              className="flex h-13 items-center justify-center rounded-[var(--sf-control-radius)] bg-[var(--sf-accent)] font-extrabold"
            >
              إتمام الطلب
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

function CheckoutPage({
  storefront,
  authError,
  customerAccount,
}: StorefrontThemePageProps) {
  const cart = useStorefrontCart();
  const router = useRouter();
  const [error, setError] = useState("");
  const defaultFulfillment = storefront.fulfillment.deliveryEnabled
    ? "delivery"
    : "pickup";
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">(
    defaultFulfillment,
  );
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await submitStorefrontCheckoutAction({
          slug: storefront.slug,
          token: storefront.token,
          customerName: String(form.get("name") ?? ""),
          customerPhone: String(form.get("phone") ?? ""),
          customerEmail: String(form.get("email") ?? ""),
          address: String(form.get("address") ?? ""),
          notes: String(form.get("notes") ?? ""),
          zoneId: String(form.get("zoneId") ?? "") || null,
          fulfillmentType,
          paymentMethod: "cash_on_delivery",
          lines: cart.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        });
        cart.clear();
        router.push(
          buildStorefrontPath(storefront, `/order/${result.trackingToken}`),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "تعذر إرسال الطلب");
      }
    });
  }
  if (cart.hydrated && !cart.lines.length)
    return <CartPage storefront={storefront} />;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black">إتمام الطلب</h1>
      <form
        onSubmit={submit}
        className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]"
      >
        <div className="lg:col-span-2">
          <StorefrontCustomerAuth
            slug={storefront.slug}
            token={storefront.token}
            previewToken={storefront.previewToken}
            initialError={authError}
            signedInAs={customerAccount?.email ?? customerAccount?.displayName}
          />
        </div>
        <section className="space-y-4 rounded-2xl bg-white p-5 sm:p-6">
          <h2 className="text-xl font-black">بيانات الطلب</h2>
          {[
            ["name", "الاسم", "text", true],
            ["phone", "رقم الموبايل", "tel", true],
            ["email", "البريد الإلكتروني (اختياري)", "email", false],
          ].map(([name, label, type, required]) => (
            <label key={String(name)} className="block text-sm font-bold">
              {label}
              <input
                required={Boolean(required)}
                name={String(name)}
                type={String(type)}
                className="mt-2 h-13 w-full rounded-[var(--sf-control-radius)] border border-[var(--sf-border)] px-4 outline-none focus:border-[var(--sf-primary)] focus:ring-3 focus:ring-[#482AD6]/15"
              />
            </label>
          ))}
          {storefront.fulfillment.deliveryEnabled &&
          storefront.fulfillment.pickupEnabled ? (
            <div className="grid grid-cols-2 gap-2">
              {(["delivery", "pickup"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFulfillmentType(type)}
                  className={`h-12 rounded-xl border font-bold ${fulfillmentType === type ? "border-[var(--sf-primary)] bg-[#F1EDFF] text-[var(--sf-primary)]" : "border-[var(--sf-border)]"}`}
                >
                  {type === "delivery" ? "توصيل" : "استلام من الفرع"}
                </button>
              ))}
            </div>
          ) : null}
          {fulfillmentType === "delivery" ? (
            <>
              <label className="block text-sm font-bold">
                منطقة التوصيل
                <select
                  required
                  name="zoneId"
                  className="mt-2 h-13 w-full rounded-[var(--sf-control-radius)] border border-[var(--sf-border)] bg-white px-4"
                >
                  {storefront.fulfillment.zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} —{" "}
                      {formatCurrency(zone.fee, storefront.currency)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                العنوان بالتفصيل
                <input
                  required
                  name="address"
                  className="mt-2 h-13 w-full rounded-[var(--sf-control-radius)] border border-[var(--sf-border)] px-4 outline-none focus:border-[var(--sf-primary)]"
                />
              </label>
            </>
          ) : (
            <div className="rounded-xl bg-[#F1EDFF] p-4 text-sm font-bold text-[var(--sf-primary)]">
              الاستلام من الفرع — هنأكد معك الموعد.
            </div>
          )}
          <label className="block text-sm font-bold">
            ملاحظات
            <textarea
              name="notes"
              rows={3}
              className="mt-2 w-full rounded-[var(--sf-control-radius)] border border-[var(--sf-border)] p-4 outline-none focus:border-[var(--sf-primary)]"
            />
          </label>
          <div className="rounded-xl border-2 border-[var(--sf-primary)] bg-[#F1EDFF] p-4">
            <p className="font-extrabold">الدفع عند الاستلام</p>
            <p className="mt-1 text-sm text-[var(--sf-muted)]">
              هتدفع قيمة الطلب عند وصوله أو استلامه.
            </p>
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-[#FFF0EF] p-3 text-sm font-bold text-[var(--sf-danger)]"
            >
              {error}
            </p>
          ) : null}
        </section>
        <aside className="h-fit rounded-2xl bg-white p-5">
          <h2 className="font-black">طلبك ({cart.count})</h2>
          <div className="my-5 space-y-2 text-sm">
            {cart.lines.map((line) => (
              <div key={line.id} className="flex justify-between gap-3">
                <span className="line-clamp-1">
                  {line.name} × {line.quantity}
                </span>
                <strong>
                  {formatCurrency(
                    line.unitPrice * line.quantity,
                    storefront.currency,
                  )}
                </strong>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-[var(--sf-border)] pt-4 text-lg">
            <span>الإجمالي المبدئي</span>
            <strong>
              {formatCurrency(cart.subtotal, storefront.currency)}
            </strong>
          </div>
          <button
            disabled={pending || !storefront.canOrder || !cart.lines.length}
            className="mt-5 flex h-13 w-full items-center justify-center rounded-[var(--sf-control-radius)] bg-[var(--sf-accent)] font-extrabold disabled:opacity-50"
          >
            {pending ? "جاري إرسال الطلب..." : "تأكيد الطلب"}
          </button>
        </aside>
      </form>
    </main>
  );
}

function OrderPage({ order }: StorefrontThemePageProps) {
  if (!order)
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-black">تعذر العثور على الطلب</h1>
      </main>
    );
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--sf-card-shadow)] sm:p-8">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#DFF8F5] text-[var(--sf-success)]">
          <Check className="size-10" />
        </div>
        <h1 className="mt-6 text-3xl font-black">تم استلام طلبك!</h1>
        <p className="mt-2 font-bold text-[var(--sf-primary)]" dir="ltr">
          {order.orderNumber}
        </p>
        <p className="mt-3 leading-7 text-[var(--sf-muted)]">
          هنراجع الطلب ونجهزه للشحن. احتفظ برابط الصفحة لمتابعة الحالة.
        </p>
        <div className="mt-6 rounded-2xl bg-[var(--sf-bg)] p-4 text-start">
          <div className="flex justify-between">
            <span>حالة الطلب</span>
            <strong>{orderStatusLabel(order.status)}</strong>
          </div>
          <div className="mt-2 flex justify-between">
            <span>حالة الدفع</span>
            <strong>{paymentStatusLabel(order.paymentStatus)}</strong>
          </div>
          {order.items.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="mt-3 flex justify-between border-t border-[var(--sf-border)] pt-3 text-sm"
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <strong>{formatCurrency(item.lineTotal, order.currency)}</strong>
            </div>
          ))}
          <div className="mt-4 flex justify-between border-t border-[var(--sf-border)] pt-4 text-lg">
            <span>الإجمالي</span>
            <strong>{formatCurrency(order.grandTotal, order.currency)}</strong>
          </div>
        </div>
      </div>
    </main>
  );
}

function NotFound({ storefront }: StorefrontThemePageProps) {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <span className="text-7xl">🪀</span>
      <h1 className="mt-5 text-3xl font-black">الصفحة مش موجودة</h1>
      <p className="mt-3 text-[var(--sf-muted)]">
        ممكن اللعبة اتحركت لمكان تاني.
      </p>
      <Link
        href={buildStorefrontPath(storefront)}
        className="mt-6 inline-flex h-12 items-center rounded-xl bg-[var(--sf-accent)] px-5 font-bold"
      >
        العودة للرئيسية
      </Link>
    </main>
  );
}

export const nelaabTheme: StorefrontThemeDefinition = {
  manifest: {
    slug: "nelaab",
    version: 1,
    nameAr: "نلعب",
    descriptionAr: "تجربة مرحة وواضحة لمتاجر الألعاب والهدايا",
    preview: { background: "#FFF7E6", primary: "#482AD6", accent: "#FFD32A" },
    capabilities: { rtl: true, ltr: true, productImages: true },
    sectionSlots: [
      "hero",
      "ageSelector",
      "featuredCategories",
      "featuredProducts",
      "benefits",
    ],
    tokens,
  },
  Shell,
  pages: {
    Home,
    Listing,
    Search: SearchPage,
    Product: ProductPage,
    Cart: CartPage,
    Checkout: CheckoutPage,
    Order: OrderPage,
    Login: NelaabLoginPage,
    Account: NelaabAccountPage,
    NotFound,
  },
};
