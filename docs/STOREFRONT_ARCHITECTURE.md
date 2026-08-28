# Storefront architecture

The public storefront is independent from the restaurant menu UI, settings, and order workflow. It intentionally reuses only Velora's underlying catalog, pricing, promotions, customer, and inventory sources of truth.

## Boundaries

- `src/modules/storefront/core` owns stable, presentation-neutral contracts.
- `services/storefront.service.ts` maps Velora catalog data into the public storefront read model.
- `themes/<slug>` owns page composition and visual tokens only. A theme must never calculate authoritative prices, stock, discounts, delivery fees, or order state.
- `core/theme-registry.ts` is the only executable theme registry. Database values select a known slug; they never select a module or component name.
- `/store/[slug]` is the public route family. `/menu/[slug]` remains the restaurant/QR menu and is not a storefront compatibility layer.
- Storefront discovery and runtime behavior use only `storefront_*` settings. They never fall back to `online_menu_*` values.
- Product publication uses `show_on_storefront`; changing `show_on_online_menu` cannot publish or unpublish a storefront product.
- Ecommerce orders live in `storefront_orders` and `storefront_order_items`; neither checkout nor tracking reads or writes `online_orders`.

## Adding a theme

1. Add an immutable slug to `StorefrontThemeSlug`.
2. Implement all `StorefrontThemePages`, a shell, semantic tokens, and the manifest contract.
3. Register the static import in `theme-registry.ts`.
4. Add its catalog default and config schema migration, then run the shared theme contract test.
5. Verify RTL/LTR, keyboard/focus, reduced motion, empty/error/disabled states, and the supported viewport matrix.

No commerce service or checkout action should change when a theme is added.

## Configuration and access

Store settings use an isolated namespace: `storefront_slug`, `storefront_enabled`, `storefront_ordering_enabled`, `storefront_unlisted`, `storefront_token`, `storefront_hours`, `storefront_fulfillment`, `storefront_brand`, `storefront_draft`, `storefront_published`, and `storefront_preview_token`. Configurations are versioned and schema-validated. Preview requires the matching token and published traffic never reads draft data.

Preview tokens expire after 30 minutes and preview resolution rechecks the organization's current theme entitlement. Invalid, expired, or unauthorized previews resolve as not found. Storefront reads and order creation use dedicated rate-limit actions and buckets, independent from menu traffic.

The executable registry validates unique slugs, positive manifest versions, a shell, and every required page contract at initialization. Stored configuration can select only a registry slug; config migrations are deterministic data transforms and never resolve module names from the database.

Platform catalog and organization entitlements use distinct `storefront_theme_catalog` and `storefront_theme_entitlements` keys. The default theme is always recoverable. Removing an entitlement blocks future activation but does not mutate the currently published configuration.

## Catalog attributes

`attribute_definitions` provides organization-scoped typed definitions. `product_attribute_values` stores validated values and enforces same-organization ownership in the database. Nelaab's age, skill, and interest definitions are seed data rather than toy-specific product columns.

## Shared master data and channel extensions

Products remain a single operational master shared by POS, inventory, purchasing, invoices, and storefront. Storefront-only presentation lives in `storefront_product_content` and `storefront_product_media`; store/channel price overrides live in `storefront_product_prices`. Missing extension values deliberately fall back to the master product. The server resolves the active store override before promotions and snapshots the resolved title, price, description, and specifications into the order item.

Customers remain a single organization-scoped master keyed by organization and normalized phone. Storefront checkout upserts that master in the same transaction as order creation, preserves existing email when checkout omits it, updates first/last order dates, and stores reusable delivery addresses in `customer_addresses`. Every order still keeps immutable customer and shipping snapshots so later customer edits never rewrite history.

Storefront management belongs to `/storefront`, including publishing, theme/configuration, product presentation, media, specifications, and channel pricing. Generic branch settings do not render storefront controls; the selected branch still scopes fulfillment, availability, publishing, and price overrides.

The module uses stable task routes: `/storefront` for the operational overview, `/storefront/products` for channel presentation and pricing, `/storefront/orders` for ecommerce fulfillment, and `/storefront/settings` for publishing, identity, domain, theme, and ordering rules. The legacy `/storefront-orders` route redirects to the module route. Customer records are intentionally not duplicated inside this module; staff manage the shared customer history from the central customers module.

## Domain and customer identity

An organization custom domain may explicitly target one enabled storefront through `storefront_domain_enabled`. Only one store per organization may claim the custom-domain landing page. The proxy resolves the verified host to its organization and redirects `/` to that store's public route; unverified and suspended hosts remain fail-closed. OAuth callback origins for every custom domain must be allow-listed in Supabase.

Checkout is guest-first and never requires authentication. Optional Google, Apple, and Facebook OAuth uses `/store-auth/callback`, separate from employee authentication. `storefront_customer_accounts` maps a Supabase auth identity to one organization and, once known, the shared customer master. Checkout links the account to the phone-resolved customer atomically; it never creates a second customer history. Provider availability still depends on enabling and configuring that provider in Supabase Auth.

Public `/store/[slug]/login` and `/store/[slug]/account` pages expose optional sign-in, order history, tracking links, and saved-address summaries. They are account utilities rather than catalog landing pages and must remain excluded from search indexing. A signed-in identity without a linked customer remains valid and is linked after its first phone-resolved checkout.

## Checkout

The client cart is advisory. Checkout sends identifiers and quantities only. The server reloads storefront-visible products and variants, recalculates promotions and storefront delivery, then creates an ecommerce order, immutable line snapshots, and tracked-stock reservations in one database transaction. The ecommerce lifecycle is `pending → confirmed → processing → ready_to_ship → shipped → delivered`, with explicit cancellation, return, and refund terminal paths. Cancellation and its reservation release commit atomically and are idempotent. COD remains pending until delivery. V1 exposes only the `cash_on_delivery` provider; provider contracts allow later payment integrations without entering theme code.
