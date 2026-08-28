# Design System — velora

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

## Direction

Evolve the existing identity toward a modern, premium, minimal, calm, product-specific system appropriate to a **digital** product. Avoid generic templates, excessive cards/gradients/shadows/radii, oversized type, arbitrary decoration, and blind cloning.

## Foundation and governance

Centralize semantic colors, spacing (prefer 4/8/12/16/20/24/32/40/48/64), typography roles, radii, elevation, motion, breakpoints, containers, z-index, and component sizes. New values must reuse or enter the system; document justified exceptions. Use professional Arabic typography where relevant and logical properties for first-class RTL. Verify 320–375px, 390–430px, tablet, laptop, and large desktop. Preserve visible focus, contrast, keyboard use, practical touch targets, reduced motion, and layout stability. Reuse before create and review cross-page impact before shared changes.

## Meridian list and filter rules

- Entity collections default to a compact table from tablet widths upward and a compact entity card on mobile.
- Kanban is optional only when records move through a meaningful lifecycle or status workflow; it is not a decorative substitute for a table.
- Date, status, warehouse, and view filters must use shared controls and persist in the URL so navigation and return actions preserve context.
- Summary metrics and charts must reflect the active filters. Empty search results are distinct from a genuinely empty dataset.
- Row actions use a matching semantic icon and restrained semantic color; primary creation remains in the page header.
- Compact module-navigation cards use two equal columns on phones when labels remain readable; reduce mobile type and spacing without shrinking touch targets, then expand to four columns on wide screens.

<!-- CODEX-PRODUCT-FOUNDATION:START -->
# Design System — velora

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

## Direction

Evolve the existing identity toward a modern, premium, minimal, calm, product-specific system appropriate to a **digital** product. Avoid generic templates, excessive cards/gradients/shadows/radii, oversized type, arbitrary decoration, and blind cloning.

## Foundation and governance

Centralize semantic colors, spacing (prefer 4/8/12/16/20/24/32/40/48/64), typography roles, radii, elevation, motion, breakpoints, containers, z-index, and component sizes. New values must reuse or enter the system; document justified exceptions. Use professional Arabic typography where relevant and logical properties for first-class RTL. Verify 320–375px, 390–430px, tablet, laptop, and large desktop. Preserve visible focus, contrast, keyboard use, practical touch targets, reduced motion, and layout stability. Reuse before create and review cross-page impact before shared changes.
<!-- CODEX-PRODUCT-FOUNDATION:END -->
