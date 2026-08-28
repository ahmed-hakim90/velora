# Velora Print Design System

## Decision

Commercial documents and A4 receipts use one presentation system: shared A4 page geometry, typography, color tokens, header, party, metadata, signatures, optional QR, and footer. Business services remain the source of totals, balances, payment status, and document data.

## Variants

- `executive` is the default for customer-facing invoices and receipts.
- `minimal` is the dense option for internal, statement, inventory, and row-heavy documents.
- `corporate` adds one dark branded header for formal external documents.

Legacy template layout values remain readable and are mapped to the closest shared variant so saved organization settings do not break.

## Configuration

`PRINT_DOCUMENT_CONFIGS` describes document presentation without duplicating complete templates. Receipt configurations disable the commercial item table, prioritize the amount, and select configurable party and signature labels. Refund receipts use the same receipt layout with a different amount label and no balance summary.

The initial supported configuration catalog includes invoices, tax invoices, quotations, sales orders, delivery notes, purchase orders and invoices, credit notes, payment/cash/supplier/refund receipts, vouchers, customer/supplier statements, stock transfers, and inventory adjustments. Future types should extend the catalog and existing shared sections instead of introducing another print engine.

## Data and security boundaries

- Components format values supplied by the domain layer; they do not recompute totals or balances.
- QR is rendered only when a real encoded value is supplied.
- Card payment presentation is limited to safe labels and values supplied by the caller; full PAN, CVV, credentials, and secrets must never enter print data.
- Arabic and English must share the same components via `dir`, logical properties, and translated labels rather than separate templates.

## Page contract

Default output is A4 portrait with `12mm 12mm 14mm` page margins. The receipt configuration is A4 by default. Thermal output remains a future size adapter and must not fork business mapping or calculation logic.
