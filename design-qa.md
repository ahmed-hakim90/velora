# Date range picker design QA

- Source visual truth: `/var/folders/3m/vwzv8hc14j3gdlkm8wtvscg80000gn/T/codex-clipboard-504768c0-0c08-4e1f-bbff-c2ffb647d085.png` (424 × 80 px) and the supplied two-month calendar reference.
- Implementation screenshot: `/Users/hakimo/Developer/velora/.codex/product-card-range-final.png` (1085 × 720 px, desktop CSS viewport 1280 × 720, DPR 1).
- Monthly closing screenshot: `/Users/hakimo/Developer/velora/.codex/monthly-closing-date-range-final.png` (desktop CSS viewport 1280 × 720, picker open).
- Product-card regression screenshot: `/Users/hakimo/Developer/velora/.codex/product-card-date-range-centered.png` (desktop CSS viewport 1280 × 720, picker open).
- Focused comparison: `/Users/hakimo/Developer/velora/.codex/design-qa-date-range-focused.png`.
- State: date range selected, picker open, dark theme, English UI.

## Findings

- No actionable P0/P1/P2 mismatch remains. The date range is presented as one bordered input with a leading calendar icon and one continuous “from — to” value.
- The open picker shows two adjacent months on desktop, range presets, navigation, clear, and today actions.
- Days outside each displayed month are now invisible and disabled, so the same calendar date is not repeated in both month grids.
- The picker is fixed to the viewport, preventing clipping inside cards, filter bars, and tables.

## Required fidelity surfaces

- Fonts and typography: uses the product typography and a compact single-line range with tabular numerals; hierarchy matches the reference control.
- Spacing and layout: one continuous input, matching rounded border, balanced icon/text spacing, and no internal split.
- Colors and tokens: existing dark-theme card, border, muted icon, and selected-range tokens are preserved.
- Image/icon fidelity: uses the existing Lucide calendar/navigation icon set; no raster assets are required for this UI control.
- Copy/content: live localized dates and translated preset/action labels are used.

## Interaction and responsive checks

- Preset selection updates the URL and closes the dialog.
- Escape and backdrop close the dialog.
- Keyboard focus stays inside the open dialog, Escape restores focus to the range trigger, and background scrolling is locked only while open.
- Manual day selection completes and applies a valid ordered range.
- Clear disables the monthly-closing generate action until a complete range is selected again.
- Month navigation and one-, two-, and three-month presets were exercised in the browser.
- Month presets clamp the start day to the last valid day of shorter target months, avoiding JavaScript month overflow around the 29th–31st.
- Desktop renders two months; the responsive layout keeps one visible month on mobile.
- RTL keeps chronological dates readable left-to-right while preserving the surrounding Arabic layout.
- Compact KPI and summary groups use two columns at phone widths; long-form cards and data-entry forms remain single-column where compression would hurt readability.
- Product-card branch and warehouse selectors now shrink to their two-column mobile grid instead of retaining a fixed width that could create horizontal overflow on narrow phones.
- Waste and stock-count filters place their two compact selectors side by side on phones while keeping the date range full width.
- Expense filters now use two compact fields per mobile row; the unified period picker and clear action remain full width.
- Container and customs-certificate lists keep the date range full width and pair search with status on phone layouts.
- Audit-log filters pair action and user on phones, keep store and date range readable at full width, and preserve full-width actions.
- Shared report filters place store and payment method side by side only when both are present; a lone filter retains the full row.
- Trial balance, income statement, and account-ledger filters keep account/range controls full width while pairing the compact store selector with the display action on phones.
- Balance-sheet totals use two summary cards per mobile row.
- Balance-sheet date/store controls and chart-of-accounts search/type controls use two mobile columns; the balance-sheet action remains full width.
- Treasury movement filters pair treasury and movement type on phones while the date range remains a full-width control.
- Scheduled-report checkbox choices and compact customer invoice details use two mobile columns.
- The shared picker rejects malformed or impossible date strings instead of allowing JavaScript date rollover inside the control.
- Repository-wide ESLint completed cleanly with zero errors and zero warnings; the product-card route was reloaded successfully after the final changes.
- The optimized Next.js production build completed successfully, including TypeScript, page-data collection, and generation of all static routes.
- Final Vitest run passed all 135 test files and all 630 tests without retries or failures.
- Live 390 × 844 browser QA confirmed no page-level horizontal overflow, one visible calendar month, and a date dialog fully contained within the phone viewport.
- Live breakpoint matrix also passed at 320 × 700 (one month), 768 × 900 (two months), and 1280 × 720 (two months), with no page-level horizontal overflow and the dialog fully contained at every size.
- A live 390 px mobile route sweep passed for waste, stock count, expenses, containers, customs certificates, audit log, trial balance, income statement, account ledger, balance sheet, and treasury: all 11 loaded without an error state or horizontal overflow.
- Runtime-log QA was clean for product card, expenses, treasury, and the actual audit UI at `/settings?tab=audit`. Visiting the legacy `/audit` redirect emits a Turbopack development-only performance-measure error; the destination UI itself is clean and the production build passes.
- Final handoff audit fixed a reports-dashboard locale regression by deriving `dir` from the supported `language` value; targeted ESLint, TypeScript, and diff checks pass afterward.
- Post-fix suite rerun completed 628/630 before two unrelated 5-second timeouts under load; both timed-out files were rerun together and all 7 tests passed in 3.48 seconds. The earlier clean full run remains 630/630.
- A fresh optimized production build after the final reports-dashboard direction fix passed compilation, TypeScript, page-data collection, and static generation; the development server remains available on port 3000.
- Live 390 px geometry checks confirmed waste selectors share one equal-width row (174 px each), expense selectors form two equal-width pairs, and both pages keep the date-range trigger on a full filter row.
- TypeScript and targeted ESLint checks pass with no errors.

## Comparison history

- Initial mismatch: two native date inputs opened separate operating-system calendars.
- First fix: replaced them with a custom range picker and two-month desktop calendar.
- Second mismatch: adjacent-month filler dates repeated across the two calendars and the trigger still looked split.
- Final fix: hid and disabled outside-month cells and changed the trigger to one continuous date-range input.
- Closing-screen regression: an ancestor card clipped the anchored desktop popover; the picker was moved to a centered fixed overlay and recaptured with the complete calendar visible.

## Follow-up polish

- P3: the exact date text format remains locale-driven instead of forcing the English abbreviated-month style shown in the example.

final result: passed
