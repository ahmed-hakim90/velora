# POS responsive design decision

The POS uses one task-first layout with two responsive compositions:

- Below `768px`, the catalog is the primary surface. The cart is opened from a persistent bottom summary and uses a bottom sheet.
- From `768px`, the cart remains visible beside the catalog so small landscape tablets can sell without switching surfaces.
- Product tiles are compact, keep a stable `16:9` media slot, and use the whole tile as the add target. Products with variants or modifiers keep their existing selection flows.
- At `320px` the catalog uses two columns. From `350px` through common 5-inch widths (`360–430px`) it uses three compact columns; larger widths use auto-fitting columns with a stable minimum tile width.
- Search and barcode scanning share one input. Searchable product and variant data is indexed when the catalog changes rather than rebuilt for every keystroke. A scanner submission uses the exact product or variant barcode/SKU first, clears the successful scan, and keeps the existing variant, modifier, and weight flows. `/` focuses and selects the search from outside editable controls, while `Escape` clears it; neither shortcut takes over an open dialog.
- Payment methods remain direct actions. Credit, split payment, manager approval, and other guarded flows retain their existing confirmation steps.
- Receipt success prioritizes browser print, WhatsApp, and a new sale. A4 and USB printing remain available as secondary actions.
- When a receipt has no customer phone, WhatsApp accepts a one-time phone number. It is normalized for the link and is never persisted to the customer record.

Compact means reducing chrome, gaps, and repeated descriptions—not shrinking interactive controls. All POS changes must preserve RTL/LTR parity, visible focus, at least `44px` touch targets for controls at every breakpoint, safe-area padding, and the existing checkout, inventory, permission, loyalty, promotion, and receipt contracts.

Mobile height follows the live visual viewport (`dvh`, with `svh` fallback) and uses `interactive-widget=resizes-content`, so layouts resize when browser chrome or the keyboard changes. Browser URL chrome cannot be forcibly hidden by a web page; permanent URL-free operation uses the existing standalone PWA installation. Physical notch and home-indicator insets must remain protected with `env(safe-area-inset-*)` and must not be visually “compressed”.
