-- Quantity promotions apply only to complete groups. For example, a 1 kg
-- threshold discounts 2 kg of a 2.4 kg line; the remaining 0.4 kg stays at
-- list price. Fixed discounts repeat once per complete group.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(
    'public.evaluate_cart_promotions(uuid,uuid,text,jsonb,text,timestamptz)'::regprocedure
  ) INTO v_definition;

  v_old := $old$
        IF v_qty >= v_min_qty THEN
          IF v_cfg ? 'percent' THEN
            v_pct := LEAST(100, GREATEST(0, COALESCE((v_cfg->>'percent')::numeric, 0)));
            v_disc := round(v_gross * (v_pct / 100.0), 2);
          ELSE
            v_amt := GREATEST(0, COALESCE((v_cfg->>'amount')::numeric, 0));
            v_disc := round(LEAST(v_gross, v_amt), 2);
          END IF;
        END IF;$old$;
  v_new := $new$
        IF v_min_qty > 0 AND v_qty >= v_min_qty THEN
          IF v_cfg ? 'percent' THEN
            v_pct := LEAST(100, GREATEST(0, COALESCE((v_cfg->>'percent')::numeric, 0)));
            v_disc := round(
              v_list_unit * (floor(v_qty / v_min_qty) * v_min_qty) * (v_pct / 100.0),
              2
            );
          ELSE
            v_amt := GREATEST(0, COALESCE((v_cfg->>'amount')::numeric, 0));
            v_disc := round(LEAST(v_gross, v_amt * floor(v_qty / v_min_qty)), 2);
          END IF;
        END IF;$new$;

  IF strpos(v_definition, v_old) = 0 THEN
    RAISE EXCEPTION 'Could not locate quantity promotion calculation';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  v_definition := replace(
    v_definition,
    'v_buy := GREATEST(1, COALESCE((v_cfg->>''buy_qty'')::numeric, 1));',
    'v_buy := GREATEST(1, floor(COALESCE((v_cfg->>''buy_qty'')::numeric, 1)));'
  );
  v_definition := replace(
    v_definition,
    'v_get := GREATEST(1, COALESCE((v_cfg->>''get_qty'')::numeric, 1));',
    'v_get := GREATEST(1, floor(COALESCE((v_cfg->>''get_qty'')::numeric, 1)));'
  );
  EXECUTE v_definition;
END
$migration$;
