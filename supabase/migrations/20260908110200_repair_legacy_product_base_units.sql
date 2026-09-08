-- Migration 036 added base_unit with a NOT NULL 'piece' default before trying to
-- backfill NULL rows, so legacy weight/volume/count products retained 'piece'.
-- `unit` was the canonical stock unit before that migration and is the safe source.
UPDATE public.products
SET base_unit = unit
WHERE base_unit = 'piece'
  AND unit <> 'piece';

-- Fail deployment rather than retaining recipes that checkout cannot convert.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM product_recipe_lines rl
    JOIN products p ON p.id = rl.ingredient_product_id
    WHERE NOT measurement_units_compatible(rl.unit, COALESCE(p.base_unit, p.unit))
  ) THEN
    RAISE EXCEPTION 'Existing recipe lines contain units incompatible with ingredient base units';
  END IF;
END;
$$;
