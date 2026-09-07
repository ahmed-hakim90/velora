-- The atomic purchase-receipt function depends on this overload. Some hosted
-- databases were created after the shelf-life columns existed but before the
-- legacy numbered migration that originally defined the helper was applied.
CREATE OR REPLACE FUNCTION public.calculate_product_expiry_date(
  p_production_date date,
  p_shelf_life_value integer,
  p_shelf_life_unit public.shelf_life_unit_type
)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN p_production_date IS NULL THEN NULL
    WHEN COALESCE(p_shelf_life_value, 0) <= 0 THEN p_production_date
    ELSE (
      p_production_date
      + CASE COALESCE(p_shelf_life_unit, 'days'::public.shelf_life_unit_type)
          WHEN 'years'::public.shelf_life_unit_type
            THEN pg_catalog.make_interval(years => p_shelf_life_value)
          WHEN 'months'::public.shelf_life_unit_type
            THEN pg_catalog.make_interval(months => p_shelf_life_value)
          ELSE pg_catalog.make_interval(days => p_shelf_life_value)
        END
    )::date
  END
$$;

REVOKE ALL ON FUNCTION public.calculate_product_expiry_date(
  date,
  integer,
  public.shelf_life_unit_type
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.calculate_product_expiry_date(
  date,
  integer,
  public.shelf_life_unit_type
) TO authenticated, service_role;
