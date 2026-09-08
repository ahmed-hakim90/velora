import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

const hardening = readMigration("20260908110000_harden_recipe_inventory_logic.sql");
const runtime = readMigration("20260908110100_recipe_cost_base_unit_runtime.sql");
const repair = readMigration("20260908110200_repair_legacy_product_base_units.sql");
const deleteTrigger = readMigration(
  "20260908110400_fix_recipe_feature_delete_trigger.sql"
);

describe("recipe and ingredient inventory hardening migrations", () => {
  it("atomically replaces a validated, non-empty recipe", () => {
    expect(hardening).toContain("CREATE OR REPLACE FUNCTION public.save_product_recipe");
    expect(hardening).toContain("Recipe must contain at least one ingredient");
    expect(hardening).toContain("Recipe cannot contain duplicate ingredients");
    expect(hardening).toContain("Recipe variant does not belong to product");
    expect(hardening).toContain("DELETE FROM product_recipe_lines WHERE recipe_id = v_recipe.id");
  });

  it("uses base units for checkout, invoices, and recipe cost", () => {
    expect(hardening).toContain("COALESCE(p.base_unit, p.unit)");
    expect(runtime).toContain("public.complete_checkout_core");
    expect(runtime).toContain("public.deliver_sales_invoice");
    expect(runtime).toContain("v_ingredient.stock_unit");
  });

  it("enforces aggregate stock and materializes allowed negative balances", () => {
    expect(hardening).toContain("guard_negative_stock_level_trigger");
    expect(hardening).toContain("materialize_missing_sale_stock_level_trigger");
    expect(hardening).toContain("NEW.quantity_delta");
  });

  it("repairs legacy units and allows feature-gated recipe deletion", () => {
    expect(repair).toContain("SET base_unit = unit");
    expect(deleteTrigger).toContain("RETURN COALESCE(NEW, OLD)");
  });
});
