# Recipe and ingredient inventory invariants

Recipes describe the ingredients required for one sale quantity of a finished
product. A variant recipe takes precedence over the product recipe; when no
non-empty variant recipe exists, checkout uses the product recipe.

## Units and cost

- `products.base_unit` is the canonical stock unit.
- `products.last_unit_cost` is the cost of one `base_unit`.
- `cost_unit` and `units_per_purchase_unit` describe purchase-entry packaging;
  they are not used to cost recipe consumption.
- Recipe lines may use the ingredient base unit or a compatible metric unit:
  `kg`/`gram` and `liter`/`ml`. Count and package units only match themselves.
- Unsupported conversions are errors. They must never be interpreted as 1:1.

## Persistence and checkout

- A recipe must contain at least one unique ingredient with a positive quantity.
- `save_product_recipe` validates ownership, variant membership, ingredient type,
  and units, then replaces all lines atomically.
- Checkout aggregates the effective result through locked `stock_levels`; the
  database rejects any mutation that would make stock negative while the
  `prevent_negative_stock` flag is enabled.
- When negative stock is allowed, a missing stock level is materialized from the
  sale movement so balances and the movement ledger remain consistent.
- `order_item_deductions` stores the historical ingredient quantity and cost
  snapshot. Refunds restore the original inventory movements, not the current
  recipe.
