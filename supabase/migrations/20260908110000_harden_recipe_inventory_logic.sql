-- Make recipe writes atomic and keep recipe costing/stock units consistent.

CREATE OR REPLACE FUNCTION public.measurement_units_compatible(
  p_from public.measurement_unit,
  p_to public.measurement_unit
) RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_from = p_to
    OR (p_from IN ('kg', 'gram') AND p_to IN ('kg', 'gram'))
    OR (p_from IN ('liter', 'ml') AND p_to IN ('liter', 'ml'));
$$;

CREATE OR REPLACE FUNCTION public.validate_product_recipe_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_recipe_org uuid;
  v_ingredient_org uuid;
  v_inventory_type public.inventory_product_type;
  v_legacy_type public.product_type;
  v_base_unit public.measurement_unit;
BEGIN
  SELECT org_id INTO v_recipe_org FROM product_recipes WHERE id = NEW.recipe_id;
  SELECT org_id, inventory_product_type, product_type, COALESCE(base_unit, unit)
  INTO v_ingredient_org, v_inventory_type, v_legacy_type, v_base_unit
  FROM products WHERE id = NEW.ingredient_product_id;

  IF v_recipe_org IS NULL OR v_ingredient_org IS DISTINCT FROM v_recipe_org THEN
    RAISE EXCEPTION 'Recipe ingredient must belong to the same organization';
  END IF;
  IF v_legacy_type <> 'ingredient' AND v_inventory_type <> 'raw_material' THEN
    RAISE EXCEPTION 'Recipe lines must reference ingredient products';
  END IF;
  IF NOT measurement_units_compatible(NEW.unit, v_base_unit) THEN
    RAISE EXCEPTION 'Recipe unit % is incompatible with ingredient base unit %', NEW.unit, v_base_unit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_recipe_line_trigger ON public.product_recipe_lines;
CREATE TRIGGER validate_product_recipe_line_trigger
BEFORE INSERT OR UPDATE ON public.product_recipe_lines
FOR EACH ROW EXECUTE FUNCTION public.validate_product_recipe_line();

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
    SELECT 1
    FROM jsonb_to_recordset(p_lines) AS x(
      ingredient_product_id uuid, quantity numeric, unit measurement_unit
    )
    GROUP BY ingredient_product_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Recipe cannot contain duplicate ingredients';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_lines) AS x(
      ingredient_product_id uuid, quantity numeric, unit measurement_unit
    )
    WHERE ingredient_product_id IS NULL OR quantity IS NULL OR quantity <= 0
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

GRANT EXECUTE ON FUNCTION public.save_product_recipe(uuid, uuid, jsonb) TO authenticated;

-- Empty variant recipes must never mask a valid base recipe.
DELETE FROM public.product_recipes r
WHERE NOT EXISTS (SELECT 1 FROM public.product_recipe_lines rl WHERE rl.recipe_id = r.id);

CREATE OR REPLACE FUNCTION public.resolve_product_recipe_id(
  p_product_id uuid,
  p_variant_id uuid
) RETURNS uuid
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT r.id
  FROM product_recipes r
  WHERE r.product_id = p_product_id
    AND (r.variant_id IS NOT DISTINCT FROM p_variant_id OR (p_variant_id IS NOT NULL AND r.variant_id IS NULL))
    AND EXISTS (SELECT 1 FROM product_recipe_lines rl WHERE rl.recipe_id = r.id)
  ORDER BY CASE WHEN r.variant_id IS NOT DISTINCT FROM p_variant_id THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.compute_recipe_cost(p_recipe_id uuid)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT round(COALESCE(SUM(
    convert_unit(rl.quantity, rl.unit, COALESCE(p.base_unit, p.unit)) * p.last_unit_cost
  ), 0), 4)
  FROM product_recipe_lines rl
  JOIN products p ON p.id = rl.ingredient_product_id
  WHERE rl.recipe_id = p_recipe_id;
$$;

-- Recalculate persisted deduction and order costs from the canonical base unit.
CREATE OR REPLACE FUNCTION public.normalize_recipe_deduction_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_base_unit measurement_unit;
  v_last_cost numeric;
  v_sale_qty numeric;
BEGIN
  SELECT COALESCE(base_unit, unit), last_unit_cost
  INTO v_base_unit, v_last_cost
  FROM products WHERE id = NEW.ingredient_product_id;
  SELECT quantity INTO v_sale_qty FROM order_items WHERE id = NEW.order_item_id;

  NEW.line_cost := round(convert_unit(NEW.quantity, NEW.unit, v_base_unit) * v_last_cost, 2);
  NEW.unit_cost := CASE WHEN COALESCE(v_sale_qty, 0) > 0
    THEN round(NEW.line_cost / v_sale_qty, 4) ELSE 0 END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_order_item_recipe_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_total numeric;
  v_qty numeric;
BEGIN
  SELECT COALESCE(SUM(line_cost), 0) INTO v_total
  FROM order_item_deductions WHERE order_item_id = NEW.order_item_id;
  SELECT quantity INTO v_qty FROM order_items WHERE id = NEW.order_item_id;
  UPDATE order_items
  SET line_cost = round(v_total, 2),
      unit_cost = CASE WHEN COALESCE(v_qty, 0) > 0 THEN round(v_total / v_qty, 4) ELSE 0 END
  WHERE id = NEW.order_item_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_recipe_deduction_cost_trigger ON public.order_item_deductions;
CREATE TRIGGER normalize_recipe_deduction_cost_trigger
BEFORE INSERT OR UPDATE ON public.order_item_deductions
FOR EACH ROW EXECUTE FUNCTION public.normalize_recipe_deduction_cost();

DROP TRIGGER IF EXISTS refresh_order_item_recipe_cost_trigger ON public.order_item_deductions;
CREATE TRIGGER refresh_order_item_recipe_cost_trigger
AFTER INSERT OR UPDATE ON public.order_item_deductions
FOR EACH ROW EXECUTE FUNCTION public.refresh_order_item_recipe_cost();

-- Enforce the aggregate stock invariant at the row being mutated. This catches
-- repeated cart lines that individually passed the checkout preflight check.
CREATE OR REPLACE FUNCTION public.guard_negative_stock_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_prevent boolean;
BEGIN
  IF NEW.quantity >= 0 THEN RETURN NEW; END IF;
  SELECT COALESCE((a.value->>'prevent_negative_stock')::boolean, true)
  INTO v_prevent
  FROM stores s
  LEFT JOIN app_settings a ON a.org_id = s.org_id AND a.key = 'feature_flags'
  WHERE s.id = NEW.store_id
  LIMIT 1;
  IF COALESCE(v_prevent, true) THEN
    RAISE EXCEPTION 'Insufficient aggregate stock for product %', NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_negative_stock_level_trigger ON public.stock_levels;
CREATE TRIGGER guard_negative_stock_level_trigger
BEFORE INSERT OR UPDATE OF quantity ON public.stock_levels
FOR EACH ROW EXECUTE FUNCTION public.guard_negative_stock_level();

-- Legacy checkout updates an existing level before writing its movement. When
-- negative stock is allowed, materialize a missing level from that movement.
CREATE OR REPLACE FUNCTION public.materialize_missing_sale_stock_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NEW.movement_type = 'sale' AND NEW.quantity_delta < 0
     AND NOT EXISTS (
       SELECT 1 FROM stock_levels
       WHERE warehouse_id = NEW.warehouse_id
         AND product_id = NEW.product_id
         AND variant_id IS NOT DISTINCT FROM NEW.variant_id
     ) THEN
    INSERT INTO stock_levels (
      store_id, warehouse_id, product_id, variant_id, quantity, reorder_point, updated_at
    ) VALUES (
      NEW.store_id, NEW.warehouse_id, NEW.product_id, NEW.variant_id,
      NEW.quantity_delta, 10, now()
    ) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS materialize_missing_sale_stock_level_trigger ON public.inventory_movements;
CREATE TRIGGER materialize_missing_sale_stock_level_trigger
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.materialize_missing_sale_stock_level();
