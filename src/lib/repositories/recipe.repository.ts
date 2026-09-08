import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapRecipe, mapRecipeLine } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import type {
  MeasurementUnit,
  ProductRecipe,
  ProductRecipeLine,
  ProductRecipeLineWithProduct,
} from "@/lib/types";
import { convertUnitStrict } from "@/lib/units";

export async function getRecipeByProductId(
  productId: string,
  variantId?: string | null
): Promise<ProductRecipe | null> {
  const db = await getDb();
  let q = db.from("product_recipes").select("*").eq("product_id", productId);
  if (variantId) {
    q = q.eq("variant_id", variantId);
  } else {
    q = q.is("variant_id", null);
  }
  const { data, error } = await q.maybeSingle();
  if (error) throwDbError(error, "getRecipeByProductId");
  return data ? mapRecipe(data) : null;
}

export async function resolveRecipeId(
  productId: string,
  variantId?: string | null
): Promise<string | null> {
  if (variantId) {
    const specific = await getRecipeByProductId(productId, variantId);
    if (specific) return specific.id;
  }
  const base = await getRecipeByProductId(productId, null);
  return base?.id ?? null;
}

export async function getRecipeLines(
  recipeId: string
): Promise<ProductRecipeLine[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("product_recipe_lines")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("sort_order");
  if (error) throwDbError(error, "getRecipeLines");
  return (data ?? []).map(mapRecipeLine);
}

export async function getRecipeWithLines(
  productId: string,
  variantId?: string | null
): Promise<{
  recipe: ProductRecipe;
  lines: ProductRecipeLineWithProduct[];
} | null> {
  let recipe = variantId ? await getRecipeByProductId(productId, variantId) : null;
  if (!recipe) {
    recipe = await getRecipeByProductId(productId, null);
  }
  if (!recipe) return null;

  const rawLines = await getRecipeLines(recipe.id);
  const ingredients = (await catalogRepo.listProducts()).filter(
    (product) =>
      product.product_type === "ingredient" ||
      product.product_type === "raw_material" ||
      product.inventory_product_type === "raw_material"
  );
  const ingMap = new Map(ingredients.map((p) => [p.id, p]));

  const lines: ProductRecipeLineWithProduct[] = rawLines.map((base) => {
    const ing = ingMap.get(base.ingredient_product_id);
    const lineCost = computeLineCost(
      base.quantity,
      base.unit,
      ing?.last_unit_cost ?? 0,
      ing?.base_unit ?? ing?.unit ?? "piece"
    );
    return {
      ...base,
      ingredient_name: ing?.name ?? "مكوّن غير معروف",
      ingredient_unit: ing?.unit ?? "piece",
      ingredient_last_unit_cost: ing?.last_unit_cost ?? 0,
      ingredient_cost_unit: ing?.cost_unit ?? ing?.unit ?? "piece",
      ingredient_base_unit: ing?.base_unit ?? ing?.unit ?? "piece",
      line_cost: lineCost,
    };
  });

  return { recipe, lines };
}

export function computeLineCost(
  qty: number,
  unit: MeasurementUnit,
  unitCost: number,
  costUnit: MeasurementUnit
): number {
  const costQty = convertUnitStrict(qty, unit, costUnit);
  return Math.round(costQty * unitCost * 10000) / 10000;
}

export function computeRecipeTotalCost(
  lines: Pick<ProductRecipeLineWithProduct, "quantity" | "unit" | "ingredient_last_unit_cost" | "ingredient_base_unit">[]
): number {
  return lines.reduce(
    (sum, line) =>
      sum +
      computeLineCost(
        line.quantity,
        line.unit,
        line.ingredient_last_unit_cost,
        line.ingredient_base_unit
      ),
    0
  );
}

export async function upsertRecipe(
  productId: string,
  lines: { ingredient_product_id: string; quantity: number; unit: MeasurementUnit }[],
  variantId?: string | null
): Promise<ProductRecipe> {
  const { data, error } = await callRpc<Record<string, unknown>>("save_product_recipe", {
    p_product_id: productId,
    p_variant_id: variantId ?? null,
    p_lines: lines,
  });
  if (error || !data) throwDbError(error, "upsertRecipe");
  return mapRecipe(data as Parameters<typeof mapRecipe>[0]);
}

export async function deleteRecipe(
  productId: string,
  variantId?: string | null
): Promise<boolean> {
  const db = await getDb();
  let q = db.from("product_recipes").delete().eq("product_id", productId);
  if (variantId) {
    q = q.eq("variant_id", variantId);
  } else {
    q = q.is("variant_id", null);
  }
  const { error } = await q;
  if (error) throwDbError(error, "deleteRecipe");
  return true;
}

export async function listRecipeUsagesByIngredient(
  ingredientProductId: string
): Promise<{ recipeId: string; productId: string; variantId: string | null }[]> {
  const db = await getDb();
  const { data: lines, error: lineError } = await db
    .from("product_recipe_lines")
    .select("recipe_id")
    .eq("ingredient_product_id", ingredientProductId);
  if (lineError) throwDbError(lineError, "listRecipeUsagesByIngredient.lines");

  const recipeIds = [...new Set((lines ?? []).map((line) => line.recipe_id))];
  if (recipeIds.length === 0) return [];

  const orgId = await getOrgId();
  const { data: recipes, error: recipeError } = await db
    .from("product_recipes")
    .select("id, product_id, variant_id")
    .eq("org_id", orgId)
    .in("id", recipeIds);
  if (recipeError) throwDbError(recipeError, "listRecipeUsagesByIngredient.recipes");

  return (recipes ?? []).map((recipe) => ({
    recipeId: recipe.id,
    productId: recipe.product_id,
    variantId: recipe.variant_id,
  }));
}

export async function listProductIdsWithRecipes(): Promise<string[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("product_recipes")
    .select("product_id")
    .eq("org_id", orgId);
  if (error) throwDbError(error, "listProductIdsWithRecipes");
  return [...new Set((data ?? []).map((r) => r.product_id))];
}

export async function listRecipeKeys(): Promise<
  { productId: string; variantId: string | null }[]
> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("product_recipes")
    .select("product_id, variant_id")
    .eq("org_id", orgId);
  if (error) throwDbError(error, "listRecipeKeys");
  return (data ?? []).map((r) => ({
    productId: r.product_id,
    variantId: r.variant_id,
  }));
}

/** One round-trip for all recipe lines keyed by `${productId}:${variantId ?? ""}`. */
export async function listAllRecipeLinesByProductKey(): Promise<
  Map<string, ProductRecipeLine[]>
> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data: recipes, error: recipesError } = await db
    .from("product_recipes")
    .select("id, product_id, variant_id")
    .eq("org_id", orgId);
  if (recipesError) throwDbError(recipesError, "listAllRecipeLinesByProductKey.recipes");

  const result = new Map<string, ProductRecipeLine[]>();
  const recipeRows = recipes ?? [];
  if (recipeRows.length === 0) return result;

  const recipeIdToKey = new Map<string, string>();
  for (const recipe of recipeRows) {
    const key = `${recipe.product_id}:${recipe.variant_id ?? ""}`;
    recipeIdToKey.set(recipe.id, key);
    result.set(key, []);
  }

  const { data: lines, error: linesError } = await db
    .from("product_recipe_lines")
    .select("*")
    .in(
      "recipe_id",
      recipeRows.map((r) => r.id)
    )
    .order("sort_order");
  if (linesError) throwDbError(linesError, "listAllRecipeLinesByProductKey.lines");

  for (const row of lines ?? []) {
    const key = recipeIdToKey.get(row.recipe_id);
    if (!key) continue;
    const list = result.get(key) ?? [];
    list.push(mapRecipeLine(row));
    result.set(key, list);
  }
  return result;
}
