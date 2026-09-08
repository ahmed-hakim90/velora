-- The original feature-gate trigger returned NEW for DELETE operations. NEW is
-- NULL on DELETE, which silently cancelled every recipe/line deletion and also
-- prevented atomic recipe replacement.
CREATE OR REPLACE FUNCTION public.trg_recipes_require_feature()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  PERFORM require_feature('recipes');
  RETURN COALESCE(NEW, OLD);
END;
$$;
