-- Correct the ordered JSON expansion used by save_product_recipe on PostgreSQL.
CREATE OR REPLACE FUNCTION public.save_product_recipe(
  p_product_id uuid,
  p_variant_id uuid,
  p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id uuid := auth_org_id();
  v_recipe product_recipes%ROWTYPE;
BEGIN
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  PERFORM require_feature('recipes');
  IF NOT can_manage_recipes() THEN RAISE EXCEPTION 'Permission denied: recipe_manage'; END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
     OR COALESCE(jsonb_array_length(p_lines), 0) = 0 THEN
    RAISE EXCEPTION 'Recipe must contain at least one ingredient';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE id = p_product_id AND org_id = v_org_id AND product_type = 'finished'
  ) THEN
    RAISE EXCEPTION 'Only finished products can have recipes';
  END IF;
  IF p_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM product_variants
    WHERE id = p_variant_id AND product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Recipe variant does not belong to product';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_lines) AS x(
      ingredient_product_id uuid, quantity numeric, unit measurement_unit
    ) GROUP BY ingredient_product_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Recipe cannot contain duplicate ingredients';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_lines) AS x(
      ingredient_product_id uuid, quantity numeric, unit measurement_unit
    ) WHERE ingredient_product_id IS NULL OR quantity IS NULL OR quantity <= 0
      OR quantity::text IN ('NaN', 'Infinity', '-Infinity') OR unit IS NULL
  ) THEN
    RAISE EXCEPTION 'Recipe lines require an ingredient, positive quantity, and unit';
  END IF;

  INSERT INTO product_recipes (org_id, product_id, variant_id)
  VALUES (v_org_id, p_product_id, p_variant_id)
  ON CONFLICT (product_id, (COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  DO UPDATE SET updated_at = now()
  RETURNING * INTO v_recipe;

  DELETE FROM product_recipe_lines WHERE recipe_id = v_recipe.id;
  INSERT INTO product_recipe_lines (
    recipe_id, ingredient_product_id, quantity, unit, sort_order
  )
  SELECT v_recipe.id,
         (x.element->>'ingredient_product_id')::uuid,
         (x.element->>'quantity')::numeric,
         (x.element->>'unit')::measurement_unit,
         x.ordinality - 1
  FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS x(element, ordinality);

  RETURN to_jsonb(v_recipe);
END;
$$;
