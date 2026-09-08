import { describe, expect, it } from "vitest";
import {
  computeLineCost,
  computeRecipeTotalCost,
} from "@/lib/repositories/recipe.repository";

describe("recipe costing", () => {
  it("computes line cost with unit conversion", () => {
    const cost = computeLineCost(0.08, "kg", 12, "kg");
    expect(cost).toBeCloseTo(0.96, 2);
  });

  it("sums recipe total cost", () => {
    const total = computeRecipeTotalCost([
      {
        quantity: 1,
        unit: "cup",
        ingredient_last_unit_cost: 0.15,
        ingredient_base_unit: "cup",
      },
      {
        quantity: 0.08,
        unit: "kg",
        ingredient_last_unit_cost: 12,
        ingredient_base_unit: "kg",
      },
    ]);
    expect(total).toBeCloseTo(1.11, 2);
  });

  it("uses metric base units for cost", () => {
    expect(computeLineCost(250, "gram", 40, "kg")).toBe(10);
    expect(computeLineCost(500, "ml", 20, "liter")).toBe(10);
  });

  it("rejects incompatible recipe units", () => {
    expect(() => computeLineCost(1, "carton", 10, "piece")).toThrow(
      "لا يمكن تحويل"
    );
  });
});
