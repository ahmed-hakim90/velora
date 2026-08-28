# Wireframe Architecture — velora

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

This is a behavioral blueprint, not a redesign.

Global navigation → location/title/context/one primary action → only useful search/filter/summary → main task content → contextual detail/edit surface → local feedback and recovery.

Before implementation map: **Page goal → user journey → information architecture → sections → priority → actions → states → responsive/RTL behavior → shared components.**

Prove the system on a high-traffic primary-journey screen, a data-dense/management screen when present, and a form/detail screen. Mobile uses a priority column, reachable actions, sheets for secondary controls, safe-area and keyboard awareness. Tablet adapts deliberately; desktop uses efficient density and consistent containers; RTL/LTR preserve equal information priority.

<!-- CODEX-PRODUCT-FOUNDATION:START -->
# Wireframe Architecture — velora

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

This is a behavioral blueprint, not a redesign.

Global navigation → location/title/context/one primary action → only useful search/filter/summary → main task content → contextual detail/edit surface → local feedback and recovery.

Before implementation map: **Page goal → user journey → information architecture → sections → priority → actions → states → responsive/RTL behavior → shared components.**

Prove the system on a high-traffic primary-journey screen, a data-dense/management screen when present, and a form/detail screen. Mobile uses a priority column, reachable actions, sheets for secondary controls, safe-area and keyboard awareness. Tablet adapts deliberately; desktop uses efficient density and consistent containers; RTL/LTR preserve equal information priority.
<!-- CODEX-PRODUCT-FOUNDATION:END -->
