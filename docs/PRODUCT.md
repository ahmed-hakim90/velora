# Product Foundation — velora

## Repository evidence

- Local path: `/Users/hakimo/Developer/velora`
- Detected stack: **Next.js/React + Supabase + Tailwind CSS**
- Product class: **digital**
- Existing uncommitted paths before this foundation pass: **16**
- Package/workspace manifests: `package.json`

### Detected application areas

- `src`
- `src/app`
- `src/components`
- `src/lib`
- `src/lib/supabase`
- `src/modules`
- `src/modules/accounting/components`
- `src/modules/accounting/lib`
- `src/modules/auth/components`
- `src/modules/customers/components`
- `src/modules/customers/lib`
- `src/modules/dashboard/components`
- `src/modules/devices/components`
- `src/modules/devices/lib`
- `src/modules/expenses/components`
- `src/modules/expenses/lib`
- `src/modules/guide/components`
- `src/modules/imports-exports/components`
- `src/modules/inventory/components`
- `src/modules/inventory/lib`
- `src/modules/kitchen/components`
- `src/modules/kitchen/lib`
- `src/modules/loyalty/components`
- `src/modules/module-hubs/components`
- `src/modules/module-hubs/lib`
- `src/modules/monthly-closing/components`
- `src/modules/onboarding/components`
- `src/modules/online-menu/components`
- `src/modules/online-menu/lib`
- `src/modules/online-orders/components`

### Representative routes/screens

- `src/app/(auth)/device/pair/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/onboarding/page.tsx`
- `src/app/(auth)/pos/resume/route.ts`
- `src/app/(auth)/pos/start/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/app/(operational)/[storeSlug]/pos/page.tsx`
- `src/app/(operational)/pos/page.tsx`
- `src/app/(platform)/platform/audit/page.tsx`
- `src/app/(platform)/platform/devices/page.tsx`
- `src/app/(platform)/platform/invites/page.tsx`
- `src/app/(platform)/platform/marketing/page.tsx`
- `src/app/(platform)/platform/menu-themes/page.tsx`
- `src/app/(platform)/platform/ops/page.tsx`
- `src/app/(platform)/platform/orgs/[id]/page.tsx`
- `src/app/(platform)/platform/page.tsx`
- `src/app/(platform)/platform/sessions/page.tsx`
- `src/app/(platform)/platform/usage/page.tsx`
- `src/app/(platform)/platform/users/page.tsx`
- `src/app/(print)/print/labels/page.tsx`
- `src/app/(print)/print/orders/[id]/page.tsx`
- `src/app/(print)/print/price-list/page.tsx`
- `src/app/(print)/print/purchases/[id]/page.tsx`
- `src/app/(print)/print/purchases/[id]/receipt/page.tsx`
- `src/app/(print)/print/receipts/[id]/page.tsx`
- `src/app/(print)/print/reports/aging/page.tsx`
- `src/app/(print)/print/reports/daily-close/page.tsx`

### Representative UI/component files

- `src/app/(shell)/guide/page.tsx`
- `src/components/Velora/access-denied.tsx`
- `src/components/Velora/compact-actions.tsx`
- `src/components/Velora/confirm-action-dialog.tsx`
- `src/components/Velora/confirmation-dialog.tsx`
- `src/components/Velora/data-table-shell.tsx`
- `src/components/Velora/form-field.tsx`
- `src/components/Velora/glass-panel.tsx`
- `src/components/Velora/implicit-pos-device-binder.tsx`
- `src/components/Velora/kpi-card.tsx`
- `src/components/Velora/kpi-pulse.tsx`
- `src/components/Velora/mobile-entity-card.tsx`
- `src/components/Velora/operational-card.tsx`
- `src/components/Velora/operator-shortcut-hint.tsx`
- `src/components/Velora/page-header.tsx`
- `src/components/Velora/page-loading-skeleton.tsx`
- `src/components/Velora/page-patterns.tsx`
- `src/components/Velora/pos-readiness-banner.tsx`
- `src/components/Velora/pos-readiness-status.tsx`
- `src/components/Velora/responsive-list-layout.tsx`
- `src/components/Velora/standard-modal.tsx`
- `src/components/Velora/state-blocks.tsx`
- `src/components/Velora/status-pill.tsx`
- `src/components/layout/app-brand-mark.tsx`
- `src/components/layout/app-footer.tsx`
- `src/components/layout/app-shell-header.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/command-jump-dialog.tsx`
- `src/components/layout/command-palette.tsx`
- `src/components/layout/mobile-nav.tsx`
- `src/components/layout/operational-shell.tsx`

### Styling/token evidence

- `src/app/globals.css`

## KEEP

- Working journeys, domain behavior, integrations, permissions, data contracts, and recognizable identity.
- Existing reusable patterns proven consistent, accessible, responsive, and in active use.

## IMPROVE

- Information hierarchy, state coverage, responsive composition, accessibility, RTL/LTR quality, token consistency, and performance evidence.

## REPLACE

- Duplicated or inaccessible patterns only after a shared replacement is verified on representative screens.

## REMOVE

- Dead UI, duplicate actions, decorative clutter, unexplained one-off styles, and dependencies proven unused. Never remove capability based on visual preference.

## MISSING FOUNDATION

- Validated role/permission matrix, canonical journey map, success metrics, state inventory, visual baseline, component ownership, and decision log.

## Implementation plan

Foundation → Shared primitives → Shared patterns → Representative screens → Remaining screens → Responsive/RTL QA → Regression review

Keep every stage reviewable and reversible. No business-logic change or mass redesign is authorized here.

<!-- CODEX-PRODUCT-FOUNDATION:START -->
# Supplier cash payment source

- A cash supplier payment recorded from POS must explicitly identify its source.
- `Drawer` links the payment to the active cashier session and reduces expected cash at close.
- `Store treasury` posts against the selected store treasury and must not change session reconciliation.
- Non-cash supplier payments remain linked to the active session for audit context but do not affect expected drawer cash.

# Product Foundation — velora

## Repository evidence

- Detected stack: **Next.js/React + Supabase + Tailwind CSS**
- Product class: **digital**
- Package/workspace manifests: `package.json`

### Detected application areas

- `src`
- `src/app`
- `src/components`
- `src/lib`
- `src/lib/supabase`
- `src/modules`
- `src/modules/accounting/components`
- `src/modules/accounting/lib`
- `src/modules/auth/components`
- `src/modules/customers/components`
- `src/modules/customers/lib`
- `src/modules/dashboard/components`
- `src/modules/devices/components`
- `src/modules/devices/lib`
- `src/modules/expenses/components`
- `src/modules/expenses/lib`
- `src/modules/guide/components`
- `src/modules/imports-exports/components`
- `src/modules/inventory/components`
- `src/modules/inventory/lib`
- `src/modules/kitchen/components`
- `src/modules/kitchen/lib`
- `src/modules/loyalty/components`
- `src/modules/module-hubs/components`
- `src/modules/module-hubs/lib`
- `src/modules/monthly-closing/components`
- `src/modules/onboarding/components`
- `src/modules/online-menu/components`
- `src/modules/online-menu/lib`
- `src/modules/online-orders/components`

### Representative routes/screens

- `src/app/(auth)/device/pair/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/onboarding/page.tsx`
- `src/app/(auth)/pos/resume/route.ts`
- `src/app/(auth)/pos/start/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/app/(operational)/[storeSlug]/pos/page.tsx`
- `src/app/(operational)/pos/page.tsx`
- `src/app/(platform)/platform/audit/page.tsx`
- `src/app/(platform)/platform/devices/page.tsx`
- `src/app/(platform)/platform/invites/page.tsx`
- `src/app/(platform)/platform/marketing/page.tsx`
- `src/app/(platform)/platform/menu-themes/page.tsx`
- `src/app/(platform)/platform/ops/page.tsx`
- `src/app/(platform)/platform/orgs/[id]/page.tsx`
- `src/app/(platform)/platform/page.tsx`
- `src/app/(platform)/platform/sessions/page.tsx`
- `src/app/(platform)/platform/usage/page.tsx`
- `src/app/(platform)/platform/users/page.tsx`
- `src/app/(print)/print/labels/page.tsx`
- `src/app/(print)/print/orders/[id]/page.tsx`
- `src/app/(print)/print/price-list/page.tsx`
- `src/app/(print)/print/purchases/[id]/page.tsx`
- `src/app/(print)/print/purchases/[id]/receipt/page.tsx`
- `src/app/(print)/print/receipts/[id]/page.tsx`
- `src/app/(print)/print/reports/aging/page.tsx`
- `src/app/(print)/print/reports/daily-close/page.tsx`

### Representative UI/component files

- `src/app/(shell)/guide/page.tsx`
- `src/components/Velora/access-denied.tsx`
- `src/components/Velora/compact-actions.tsx`
- `src/components/Velora/confirm-action-dialog.tsx`
- `src/components/Velora/confirmation-dialog.tsx`
- `src/components/Velora/data-table-shell.tsx`
- `src/components/Velora/form-field.tsx`
- `src/components/Velora/glass-panel.tsx`
- `src/components/Velora/implicit-pos-device-binder.tsx`
- `src/components/Velora/kpi-card.tsx`
- `src/components/Velora/kpi-pulse.tsx`
- `src/components/Velora/mobile-entity-card.tsx`
- `src/components/Velora/operational-card.tsx`
- `src/components/Velora/operator-shortcut-hint.tsx`
- `src/components/Velora/page-header.tsx`
- `src/components/Velora/page-loading-skeleton.tsx`
- `src/components/Velora/page-patterns.tsx`
- `src/components/Velora/pos-readiness-banner.tsx`
- `src/components/Velora/pos-readiness-status.tsx`
- `src/components/Velora/responsive-list-layout.tsx`
- `src/components/Velora/standard-modal.tsx`
- `src/components/Velora/state-blocks.tsx`
- `src/components/Velora/status-pill.tsx`
- `src/components/layout/app-brand-mark.tsx`
- `src/components/layout/app-footer.tsx`
- `src/components/layout/app-shell-header.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/command-jump-dialog.tsx`
- `src/components/layout/command-palette.tsx`
- `src/components/layout/mobile-nav.tsx`
- `src/components/layout/operational-shell.tsx`

### Styling/token evidence

- `src/app/globals.css`

## KEEP

- Working journeys, domain behavior, integrations, permissions, data contracts, and recognizable identity.
- Existing reusable patterns proven consistent, accessible, responsive, and in active use.

## IMPROVE

- Information hierarchy, state coverage, responsive composition, accessibility, RTL/LTR quality, token consistency, and performance evidence.

## REPLACE

- Duplicated or inaccessible patterns only after a shared replacement is verified on representative screens.

## REMOVE

- Dead UI, duplicate actions, decorative clutter, unexplained one-off styles, and dependencies proven unused. Never remove capability based on visual preference.

## MISSING FOUNDATION

- Validated role/permission matrix, canonical journey map, success metrics, state inventory, visual baseline, component ownership, and decision log.

## Implementation plan

Foundation → Shared primitives → Shared patterns → Representative screens → Remaining screens → Responsive/RTL QA → Regression review

Keep every stage reviewable and reversible. No business-logic change or mass redesign is authorized here.
<!-- CODEX-PRODUCT-FOUNDATION:END -->
