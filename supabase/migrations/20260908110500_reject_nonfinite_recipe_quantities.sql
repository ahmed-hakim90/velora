-- Keep the deployed RPC aligned with application Number.isFinite validation.
DO $$
DECLARE
  v_definition text;
  v_patched text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.save_product_recipe(uuid,uuid,jsonb)'::regprocedure
  );
  v_patched := replace(
    v_definition,
    'quantity IS NULL OR quantity <= 0 OR unit IS NULL',
    'quantity IS NULL OR quantity <= 0 OR quantity::text IN (''NaN'', ''Infinity'', ''-Infinity'') OR unit IS NULL'
  );
  IF v_patched = v_definition THEN
    RAISE EXCEPTION 'Could not add non-finite recipe quantity validation';
  END IF;
  EXECUTE v_patched;
END;
$$;
