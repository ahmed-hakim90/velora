-- Patch the current checkout/invoice implementations to use the canonical
-- product base unit for both stock deduction and recipe cost. Keeping this in a
-- follow-up migration avoids duplicating the large operational functions.
DO $$
DECLARE
  v_signature regprocedure;
  v_definition text;
  v_patched text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.complete_checkout_core(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,sales_mode,text)'::regprocedure,
    'public.deliver_sales_invoice(uuid,payment_method,jsonb)'::regprocedure
  ]
  LOOP
    v_definition := pg_get_functiondef(v_signature);
    v_patched := replace(
      v_definition,
      'p.unit AS stock_unit',
      'COALESCE(p.base_unit, p.unit) AS stock_unit'
    );
    v_patched := replace(
      v_patched,
      'v_ingredient.cost_unit',
      'v_ingredient.stock_unit'
    );

    IF v_patched = v_definition THEN
      RAISE EXCEPTION 'Could not patch recipe base-unit logic in %', v_signature;
    END IF;
    EXECUTE v_patched;
  END LOOP;
END;
$$;
