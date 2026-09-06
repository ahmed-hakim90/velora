-- Permanently retire the legacy POS device registry and every database dependency.
-- Deliberately explicit: no broad CASCADE is used.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.cashier_sessions WHERE device_id IS NOT NULL) THEN
    RAISE NOTICE 'Removing historical device references from cashier_sessions';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pos_held_carts WHERE device_id IS NOT NULL) THEN
    RAISE NOTICE 'Removing historical device references from pos_held_carts';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_session_device_store ON public.cashier_sessions;
DROP TRIGGER IF EXISTS trg_pos_held_cart_device_store ON public.pos_held_carts;
DROP FUNCTION IF EXISTS public.check_session_device_store();
DROP FUNCTION IF EXISTS public.check_pos_held_cart_device_store();

-- Device-free replacement for complete_checkout_core
CREATE OR REPLACE FUNCTION public.complete_checkout_core(p_store_id uuid, p_session_id uuid, p_cashier_id uuid, p_customer_id uuid, p_payment_method payment_method, p_discount numeric, p_lines jsonb, p_sales_mode sales_mode DEFAULT 'retail'::sales_mode, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_warehouse_id UUID;
  v_subtotal NUMERIC := 0;
  v_tax NUMERIC := 0;
  v_total NUMERIC;
  v_line JSONB;
  v_resolved JSONB := '[]'::jsonb;
  v_resolved_line JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_qty NUMERIC;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_line_cost NUMERIC;
  v_unit_cost NUMERIC;
  v_track BOOLEAN;
  v_stock_qty NUMERIC;
  v_product_name TEXT;
  v_product_type product_type;
  v_tax_rate NUMERIC := 0;
  v_flags JSONB := '{}'::jsonb;
  v_business JSONB := '{}'::jsonb;
  v_session_settings JSONB := '{}'::jsonb;
  v_activity business_activity_type := 'retail'::business_activity_type;
  v_auto_wholesale BOOLEAN := false;
  v_recipes_enabled BOOLEAN;
  v_prevent_negative BOOLEAN;
  v_recipe_id UUID;
  v_order_item_id UUID;
  v_ingredient RECORD;
  v_deduct_qty NUMERIC;
  v_ingredient_cost NUMERIC;
  v_deduction_cost NUMERIC;
  v_deductions JSONB;
  v_max_open_hours NUMERIC := 24;
  v_block_sales_when_expired BOOLEAN := true;
  v_session_opened_at TIMESTAMPTZ;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_sale_unit measurement_unit;
  v_base_unit measurement_unit;
  v_base_qty NUMERIC;
  v_tier_id UUID;
  v_wholesale_applied BOOLEAN;
  v_sale_input_mode weight_sale_input_mode;
  v_entered_amount NUMERIC;
  v_sales_unit_type product_sales_unit_type;
  v_resolved_tier_id UUID;
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_seq INT;
  v_setting_row RECORD;
  v_promo_discount NUMERIC := 0;
  v_promo_eval JSONB;
  v_promo_lines JSONB := '[]'::jsonb;
  v_category_id UUID;
  v_line_key TEXT;
  v_list_unit_price NUMERIC;
  v_line_discount NUMERIC;
  v_promo_rule_id UUID;
  v_app JSONB;
  v_total_discount NUMERIC;
  v_line_item_map JSONB := '{}'::jsonb;
  v_merged JSONB := '[]'::jsonb;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_caller := auth_app_user_id();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_cashier_id IS DISTINCT FROM v_caller AND NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Cashier mismatch';
  END IF;

  IF NOT has_store_access(p_store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF is_period_closed(p_store_id, now()) THEN RAISE EXCEPTION 'Period is closed for this date'; END IF;

  IF COALESCE(jsonb_array_length(p_lines), 0) = 0 THEN
    RAISE EXCEPTION 'Checkout lines are required';
  END IF;

  SELECT id INTO v_warehouse_id FROM warehouses
  WHERE store_id = p_store_id AND is_default = true AND is_active = true
  LIMIT 1;
  IF v_warehouse_id IS NULL THEN RAISE EXCEPTION 'Default warehouse not found'; END IF;

  FOR v_setting_row IN
    SELECT key, value
    FROM app_settings
    WHERE org_id = v_org_id
      AND key IN ('feature_flags', 'business_activity', 'session_settings', 'tax_rate')
  LOOP
    IF v_setting_row.key = 'feature_flags' THEN
      v_flags := COALESCE(v_setting_row.value, '{}'::jsonb);
    ELSIF v_setting_row.key = 'business_activity' THEN
      v_business := COALESCE(v_setting_row.value, '{}'::jsonb);
    ELSIF v_setting_row.key = 'session_settings' THEN
      v_session_settings := COALESCE(v_setting_row.value, '{}'::jsonb);
    ELSIF v_setting_row.key = 'tax_rate' THEN
      v_tax_rate := COALESCE((v_setting_row.value->>'rate')::numeric, 0);
    END IF;
  END LOOP;

  IF COALESCE((v_flags->>'tax')::boolean, true) = false THEN
    v_tax_rate := 0;
  END IF;

  v_recipes_enabled := COALESCE((v_flags->>'recipes')::boolean, false);
  v_prevent_negative := COALESCE((v_flags->>'prevent_negative_stock')::boolean, true);
  v_activity := COALESCE((v_business->>'activity_type')::business_activity_type, 'retail'::business_activity_type);
  v_auto_wholesale := COALESCE((v_business->>'auto_apply_wholesale_by_quantity')::boolean, false);
  v_max_open_hours := COALESCE((v_session_settings->>'max_open_hours')::numeric, 24);
  v_block_sales_when_expired := COALESCE((v_session_settings->>'block_sales_when_expired')::boolean, true);

  IF p_sales_mode = 'wholesale' AND COALESCE((v_flags->>'wholesale_sales')::boolean, false) = false THEN
    RAISE EXCEPTION 'Wholesale sales are disabled';
  END IF;

  IF COALESCE((v_flags->>'inventory_deduction')::boolean, true) = false THEN
    RAISE EXCEPTION 'Inventory deduction is disabled';
  END IF;
  IF p_payment_method = 'cash' AND COALESCE((v_flags->>'payment_cash')::boolean, true) = false THEN
    RAISE EXCEPTION 'Cash payments are disabled';
  END IF;
  IF p_payment_method = 'card' AND COALESCE((v_flags->>'payment_card')::boolean, true) = false THEN
    RAISE EXCEPTION 'Card payments are disabled';
  END IF;
  IF p_payment_method = 'other' AND COALESCE((v_flags->>'payment_other')::boolean, true) = false THEN
    RAISE EXCEPTION 'Other payments are disabled';
  END IF;
  IF p_payment_method = 'wallet' AND COALESCE((v_flags->>'payment_wallet')::boolean, true) = false THEN
    RAISE EXCEPTION 'Wallet payments are disabled';
  END IF;
  IF p_payment_method = 'credit' AND COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
    RAISE EXCEPTION 'Credit sales are disabled';
  END IF;
  IF p_payment_method = 'credit' AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
  END IF;
  IF COALESCE(p_discount, 0) > 0 AND COALESCE((v_flags->>'customer_discounts')::boolean, false) = false THEN
    RAISE EXCEPTION 'Customer discounts are disabled';
  END IF;

  IF p_session_id IS NULL THEN RAISE EXCEPTION 'Active cashier session required'; END IF;

  SELECT opened_at INTO v_session_opened_at
  FROM cashier_sessions
  WHERE id = p_session_id
    AND store_id = p_store_id
    AND status = 'open'
    AND cashier_id = p_cashier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or closed cashier session';
  END IF;

  IF v_block_sales_when_expired
    AND v_session_opened_at IS NOT NULL
    AND v_session_opened_at + (v_max_open_hours || ' hours')::interval <= now()
  THEN
    RAISE EXCEPTION 'Session expired — close shift to continue';
  END IF;

  v_day_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_day_end := v_day_start + interval '1 day';
  SELECT COUNT(*) + 1 INTO v_seq
  FROM orders
  WHERE store_id = p_store_id
    AND created_at >= v_day_start
    AND created_at < v_day_end;
  v_order_number := 'SF-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_variant_id := NULLIF(v_line->>'variant_id', '')::uuid;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_sale_input_mode := NULLIF(v_line->>'sale_input_mode', '')::weight_sale_input_mode;
    v_entered_amount := COALESCE((v_line->>'entered_amount')::numeric, 0);
    v_tier_id := NULLIF(v_line->>'tier_id', '')::uuid;
    IF v_qty <= 0 AND v_sale_input_mode IS DISTINCT FROM 'by_amount' THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    IF v_sale_input_mode = 'by_amount' THEN
      IF COALESCE(
           (v_business->>'enable_price_by_amount')::boolean,
           (v_flags->>'price_by_amount')::boolean,
           false
         ) = false THEN
        RAISE EXCEPTION 'Price by amount sales are disabled';
      END IF;
      IF v_entered_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
    END IF;

    SELECT p.track_inventory, p.name, p.product_type, p.sale_unit, p.unit, p.sales_unit_type, p.base_price, p.category_id
    INTO v_track, v_product_name, v_product_type, v_sale_unit, v_base_unit, v_sales_unit_type, v_unit_price, v_category_id
    FROM products p
    WHERE p.id = v_product_id AND p.org_id = v_org_id AND p.is_active = true;

    IF v_product_name IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF v_product_type = 'ingredient' THEN
      RAISE EXCEPTION 'Ingredient products cannot be sold directly';
    END IF;

    IF v_sales_unit_type IN ('weight', 'mixed')
      AND COALESCE(
            (v_business->>'enable_weight_sales')::boolean,
            (v_flags->>'weight_sales')::boolean,
            false
          ) = false
      AND v_sale_input_mode IS NOT NULL
    THEN
      RAISE EXCEPTION 'Weight sales are disabled';
    END IF;

    IF v_sale_input_mode = 'by_amount' THEN
      v_qty := round(v_entered_amount / NULLIF(v_unit_price, 0), 4);
      IF v_qty <= 0 THEN RAISE EXCEPTION 'Invalid amount for unit price'; END IF;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      v_qty := COALESCE(
        (
          SELECT pv.quantity_value
          FROM product_variants pv
          WHERE pv.id = v_variant_id
            AND pv.product_id = v_product_id
            AND pv.variant_kind = 'weight_portion'
        ),
        v_qty
      );
    END IF;

    SELECT r.unit_price, r.tier_id, r.wholesale_applied
    INTO v_unit_price, v_resolved_tier_id, v_wholesale_applied
    FROM resolve_product_unit_price(
      v_org_id, v_product_id, v_variant_id, v_qty, v_sale_unit, p_sales_mode, v_auto_wholesale
    ) r;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'Could not resolve unit price for % (qty=%, variant=%)', v_product_name, v_qty, v_variant_id;
    END IF;
    v_tier_id := COALESCE(v_tier_id, v_resolved_tier_id);
    v_wholesale_applied := COALESCE(v_wholesale_applied, false);

    IF EXISTS (
      SELECT 1 FROM product_variants
      WHERE product_id = v_product_id AND is_active = true AND variant_kind = 'standard'
    ) AND v_variant_id IS NULL THEN
      RAISE EXCEPTION 'Variant required for %', v_product_name;
    END IF;

    IF v_variant_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM product_variants
      WHERE id = v_variant_id AND product_id = v_product_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid variant for %', v_product_name;
    END IF;

    v_line_total := round(v_unit_price * v_qty, 2);
    v_subtotal := v_subtotal + v_line_total;
    v_base_qty := convert_unit(v_qty, v_sale_unit, v_base_unit);
    v_line_cost := 0;
    v_unit_cost := 0;
    v_deductions := '[]'::jsonb;
    v_recipe_id := NULL;

    IF v_recipes_enabled THEN
      v_recipe_id := resolve_product_recipe_id(v_product_id, v_variant_id);
    END IF;

    IF v_recipes_enabled AND v_recipe_id IS NOT NULL THEN
      FOR v_ingredient IN
        SELECT rl.quantity AS recipe_qty, rl.unit AS recipe_unit,
               p.id AS ing_id, p.name AS ing_name, p.unit AS stock_unit,
               p.last_unit_cost, p.cost_unit
        FROM product_recipe_lines rl
        JOIN products p ON p.id = rl.ingredient_product_id
        WHERE rl.recipe_id = v_recipe_id
      LOOP
        v_deduct_qty := convert_unit(v_ingredient.recipe_qty * v_qty, v_ingredient.recipe_unit, v_ingredient.stock_unit);
        IF v_prevent_negative THEN
          SELECT quantity INTO v_stock_qty FROM stock_levels
          WHERE warehouse_id = v_warehouse_id AND product_id = v_ingredient.ing_id AND variant_id IS NULL
          FOR UPDATE;
          IF v_stock_qty IS NULL OR v_stock_qty < v_deduct_qty THEN
            RAISE EXCEPTION 'Insufficient stock for %', v_ingredient.ing_name;
          END IF;
        END IF;

        v_ingredient_cost := convert_unit(v_ingredient.recipe_qty, v_ingredient.recipe_unit, v_ingredient.cost_unit) * v_ingredient.last_unit_cost;
        v_deduction_cost := round(v_ingredient_cost * v_qty, 2);
        v_line_cost := v_line_cost + v_deduction_cost;

        v_deductions := v_deductions || jsonb_build_array(jsonb_build_object(
          'ing_id', v_ingredient.ing_id,
          'deduct_qty', v_deduct_qty,
          'recipe_unit', v_ingredient.recipe_unit,
          'deduction_qty', convert_unit(v_ingredient.recipe_qty * v_qty, v_ingredient.recipe_unit, v_ingredient.recipe_unit),
          'unit_cost', round(convert_unit(v_ingredient.recipe_qty, v_ingredient.recipe_unit, v_ingredient.cost_unit) * v_ingredient.last_unit_cost, 4),
          'line_cost', v_deduction_cost
        ));
      END LOOP;
      v_unit_cost := CASE WHEN v_qty > 0 THEN round(v_line_cost / v_qty, 4) ELSE 0 END;
    ELSIF v_track AND v_prevent_negative THEN
      SELECT quantity INTO v_stock_qty FROM stock_levels
      WHERE warehouse_id = v_warehouse_id AND product_id = v_product_id
        AND (variant_id IS NOT DISTINCT FROM v_variant_id)
      FOR UPDATE;
      IF v_stock_qty IS NULL OR v_stock_qty < v_base_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %', v_product_name;
      END IF;
    END IF;

    v_line_key := COALESCE(jsonb_array_length(v_resolved), 0)::text;

    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'qty', v_qty,
      'unit_price', v_unit_price,
      'line_total', v_line_total,
      'unit_cost', v_unit_cost,
      'line_cost', v_line_cost,
      'sale_unit', v_sale_unit,
      'base_qty', v_base_qty,
      'sale_input_mode', v_sale_input_mode,
      'tier_id', v_tier_id,
      'wholesale_applied', v_wholesale_applied,
      'track', v_track,
      'has_recipe', (v_recipe_id IS NOT NULL),
      'deductions', v_deductions,
      'category_id', v_category_id,
      'list_unit_price', v_unit_price,
      'discount_amount', 0,
      'promotion_rule_id', NULL,
      'line_key', v_line_key
    ));
  END LOOP;

  IF COALESCE((v_flags->>'promotions')::boolean, false) THEN
    v_promo_lines := '[]'::jsonb;
    FOR v_resolved_line IN SELECT * FROM jsonb_array_elements(v_resolved)
    LOOP
      v_promo_lines := v_promo_lines || jsonb_build_array(jsonb_build_object(
        'line_key', v_resolved_line->>'line_key',
        'product_id', v_resolved_line->>'product_id',
        'category_id', v_resolved_line->>'category_id',
        'quantity', (v_resolved_line->>'qty')::numeric,
        'unit_price', (v_resolved_line->>'unit_price')::numeric
      ));
    END LOOP;

    v_promo_eval := public.evaluate_cart_promotions(
      v_org_id,
      p_store_id,
      p_sales_mode::text,
      v_promo_lines,
      p_coupon_code
    );

    v_subtotal := 0;
    v_merged := '[]'::jsonb;
    FOR v_resolved_line IN SELECT * FROM jsonb_array_elements(v_resolved)
    LOOP
      v_line_key := v_resolved_line->>'line_key';
      v_app := NULL;
      SELECT elem
      INTO v_app
      FROM jsonb_array_elements(COALESCE(v_promo_eval->'lines', '[]'::jsonb)) elem
      WHERE elem->>'line_key' = v_line_key
      LIMIT 1;

      IF v_app IS NOT NULL THEN
        v_list_unit_price := COALESCE(
          (v_app->>'list_unit_price')::numeric,
          (v_resolved_line->>'list_unit_price')::numeric,
          (v_resolved_line->>'unit_price')::numeric
        );
        v_unit_price := COALESCE((v_app->>'unit_price')::numeric, (v_resolved_line->>'unit_price')::numeric);
        v_line_total := COALESCE((v_app->>'line_total')::numeric, (v_resolved_line->>'line_total')::numeric);
        v_line_discount := COALESCE((v_app->>'discount_amount')::numeric, 0);
        v_promo_rule_id := NULLIF(v_app->>'promotion_rule_id', '')::uuid;
      ELSE
        v_list_unit_price := COALESCE(
          (v_resolved_line->>'list_unit_price')::numeric,
          (v_resolved_line->>'unit_price')::numeric
        );
        v_unit_price := (v_resolved_line->>'unit_price')::numeric;
        v_line_total := (v_resolved_line->>'line_total')::numeric;
        v_line_discount := COALESCE((v_resolved_line->>'discount_amount')::numeric, 0);
        v_promo_rule_id := NULLIF(v_resolved_line->>'promotion_rule_id', '')::uuid;
      END IF;

      v_subtotal := v_subtotal + v_line_total;
      v_merged := v_merged || jsonb_build_array(
        v_resolved_line || jsonb_build_object(
          'list_unit_price', v_list_unit_price,
          'unit_price', v_unit_price,
          'line_total', v_line_total,
          'discount_amount', v_line_discount,
          'promotion_rule_id', v_promo_rule_id
        )
      );
    END LOOP;

    v_resolved := v_merged;
    v_promo_discount := COALESCE((v_promo_eval->>'cart_discount')::numeric, 0);
  END IF;

  IF v_subtotal IS NULL OR v_subtotal < 0 THEN
    RAISE EXCEPTION 'Order subtotal could not be calculated from lines: %', p_lines;
  END IF;

  v_total_discount := COALESCE(v_promo_discount, 0) + COALESCE(p_discount, 0);
  v_total_discount := LEAST(v_total_discount, v_subtotal);
  v_tax := round(v_subtotal * COALESCE(v_tax_rate, 0), 2);
  v_total := greatest(0, v_subtotal - v_total_discount + COALESCE(v_tax, 0));

  IF p_payment_method = 'credit' THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_total) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;
  END IF;

  INSERT INTO orders (
    store_id, session_id, order_number, customer_id, status,
    subtotal, discount, tax, total, payment_status, created_by,
    sales_mode, activity_type, promo_discount
  ) VALUES (
    p_store_id, p_session_id, v_order_number, p_customer_id, 'completed',
    v_subtotal, v_total_discount, v_tax, v_total, 'paid', p_cashier_id,
    p_sales_mode, v_activity, COALESCE(v_promo_discount, 0)
  ) RETURNING id INTO v_order_id;

  FOR v_resolved_line IN SELECT * FROM jsonb_array_elements(v_resolved)
  LOOP
    INSERT INTO order_items (
      order_id, product_id, variant_id, quantity, unit_price, modifiers, line_total,
      unit_cost, line_cost, sale_unit, base_quantity, sale_input_mode, tier_id, wholesale_applied,
      list_unit_price, discount_amount, promotion_rule_id
    ) VALUES (
      v_order_id,
      (v_resolved_line->>'product_id')::uuid,
      NULLIF(v_resolved_line->>'variant_id', '')::uuid,
      (v_resolved_line->>'qty')::numeric,
      (v_resolved_line->>'unit_price')::numeric,
      '[]'::jsonb,
      (v_resolved_line->>'line_total')::numeric,
      (v_resolved_line->>'unit_cost')::numeric,
      (v_resolved_line->>'line_cost')::numeric,
      (v_resolved_line->>'sale_unit')::measurement_unit,
      (v_resolved_line->>'base_qty')::numeric,
      NULLIF(v_resolved_line->>'sale_input_mode', '')::weight_sale_input_mode,
      NULLIF(v_resolved_line->>'tier_id', '')::uuid,
      COALESCE((v_resolved_line->>'wholesale_applied')::boolean, false),
      COALESCE(
        (v_resolved_line->>'list_unit_price')::numeric,
        (v_resolved_line->>'unit_price')::numeric
      ),
      COALESCE((v_resolved_line->>'discount_amount')::numeric, 0),
      NULLIF(v_resolved_line->>'promotion_rule_id', '')::uuid
    ) RETURNING id INTO v_order_item_id;

    v_line_key := v_resolved_line->>'line_key';
    IF v_line_key IS NOT NULL THEN
      v_line_item_map := v_line_item_map || jsonb_build_object(v_line_key, v_order_item_id);
    END IF;

    IF COALESCE((v_resolved_line->>'has_recipe')::boolean, false) THEN
      FOR v_ingredient IN
        SELECT *
        FROM jsonb_to_recordset(COALESCE(v_resolved_line->'deductions', '[]'::jsonb)) AS d(
          ing_id UUID,
          deduct_qty NUMERIC,
          recipe_unit measurement_unit,
          deduction_qty NUMERIC,
          unit_cost NUMERIC,
          line_cost NUMERIC
        )
      LOOP
        UPDATE stock_levels SET quantity = quantity - v_ingredient.deduct_qty, updated_at = now()
        WHERE warehouse_id = v_warehouse_id AND product_id = v_ingredient.ing_id AND variant_id IS NULL;

        INSERT INTO inventory_movements (
          store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
          reference_type, reference_id, created_by
        ) VALUES (
          p_store_id, v_warehouse_id, v_ingredient.ing_id, NULL, 'sale', -v_ingredient.deduct_qty,
          'order', v_order_id, p_cashier_id
        );

        INSERT INTO order_item_deductions (
          order_item_id, ingredient_product_id, quantity, unit, unit_cost, line_cost
        ) VALUES (
          v_order_item_id, v_ingredient.ing_id,
          v_ingredient.deduction_qty,
          v_ingredient.recipe_unit,
          v_ingredient.unit_cost,
          v_ingredient.line_cost
        );
      END LOOP;
    ELSIF COALESCE((v_resolved_line->>'track')::boolean, false) THEN
      UPDATE stock_levels SET quantity = quantity - (v_resolved_line->>'base_qty')::numeric, updated_at = now()
      WHERE warehouse_id = v_warehouse_id AND product_id = (v_resolved_line->>'product_id')::uuid
        AND (variant_id IS NOT DISTINCT FROM NULLIF(v_resolved_line->>'variant_id', '')::uuid);

      INSERT INTO inventory_movements (
        store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
        reference_type, reference_id, created_by
      ) VALUES (
        p_store_id, v_warehouse_id,
        (v_resolved_line->>'product_id')::uuid,
        NULLIF(v_resolved_line->>'variant_id', '')::uuid,
        'sale', -(v_resolved_line->>'base_qty')::numeric,
        'order', v_order_id, p_cashier_id
      );
    END IF;
  END LOOP;

  IF v_promo_eval IS NOT NULL THEN
    FOR v_app IN SELECT * FROM jsonb_array_elements(COALESCE(v_promo_eval->'applications', '[]'::jsonb))
    LOOP
      INSERT INTO order_promotion_applications (
        order_id, promotion_rule_id, order_item_id, level, amount, rule_name
      ) VALUES (
        v_order_id,
        NULLIF(v_app->>'promotion_rule_id', '')::uuid,
        CASE
          WHEN v_app->>'level' = 'item' AND NULLIF(v_app->>'line_key', '') IS NOT NULL
            THEN NULLIF(v_line_item_map->> (v_app->>'line_key'), '')::uuid
          ELSE NULL
        END,
        COALESCE(v_app->>'level', 'item'),
        COALESCE((v_app->>'amount')::numeric, 0),
        v_app->>'rule_name'
      );
    END LOOP;

    UPDATE promotion_rules pr
    SET usage_count = pr.usage_count + 1
    WHERE pr.org_id = v_org_id
      AND pr.coupon_code IS NOT NULL
      AND pr.id IN (
        SELECT DISTINCT (elem->>'promotion_rule_id')::uuid
        FROM jsonb_array_elements(COALESCE(v_promo_eval->'applications', '[]'::jsonb)) elem
        WHERE NULLIF(elem->>'promotion_rule_id', '') IS NOT NULL
      );
  END IF;

  INSERT INTO order_payments (order_id, method, amount)
  VALUES (v_order_id, p_payment_method, v_total);

  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_spent = total_spent + v_total,
      visit_count = visit_count + 1
    WHERE id = p_customer_id AND org_id = v_org_id;
  END IF;
  IF p_payment_method = 'credit' AND p_customer_id IS NOT NULL THEN
    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
    ) VALUES (
      v_org_id, p_store_id, p_customer_id, 'credit_sale', v_total, 0, v_order_id, v_order_number, p_cashier_id
    );
    UPDATE customers
    SET account_balance = account_balance + v_total
    WHERE id = p_customer_id AND org_id = v_org_id;
  END IF;

  PERFORM insert_audit_log('order.completed', 'order', v_order_id::text, p_store_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'total', v_total,
      'warehouse_id', v_warehouse_id,
      'sales_mode', p_sales_mode,
      'activity_type', v_activity,
      'promo_discount', COALESCE(v_promo_discount, 0),
      'discount', v_total_discount
    ));

  IF p_sales_mode = 'wholesale' THEN
    PERFORM insert_audit_log('order.wholesale_sale', 'order', v_order_id::text, p_store_id,
      jsonb_build_object('order_number', v_order_number));
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'total', v_total,
    'promo_discount', COALESCE(v_promo_discount, 0),
    'discount', v_total_discount
  );
END;
$function$;

-- Device-free replacement for complete_checkout_expired_override
CREATE OR REPLACE FUNCTION public.complete_checkout_expired_override(p_store_id uuid, p_session_id uuid, p_cashier_id uuid, p_customer_id uuid, p_payment_method payment_method, p_discount numeric, p_lines jsonb, p_sales_mode sales_mode DEFAULT 'retail'::sales_mode, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_caller UUID;
  v_role user_role;
  v_opened_at TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_caller := auth_app_user_id();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT role INTO v_role FROM users WHERE id = v_caller AND is_active = true;
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Owner or manager override required';
  END IF;

  SELECT opened_at INTO v_opened_at
  FROM cashier_sessions
  WHERE id = p_session_id
    AND store_id = p_store_id
    AND status = 'open'
  FOR UPDATE;

  IF v_opened_at IS NULL THEN
    RAISE EXCEPTION 'Invalid or closed cashier session';
  END IF;

  UPDATE cashier_sessions SET opened_at = now() WHERE id = p_session_id;

  v_result := public.complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    p_discount,
    p_lines,
    p_sales_mode,
    p_coupon_code
  );

  UPDATE cashier_sessions SET opened_at = v_opened_at WHERE id = p_session_id;

  RETURN v_result;
END;
$function$;

-- Device-free replacement for complete_checkout_split_core
CREATE OR REPLACE FUNCTION public.complete_checkout_split_core(p_store_id uuid, p_session_id uuid, p_cashier_id uuid, p_customer_id uuid, p_payment_method payment_method, p_discount numeric, p_lines jsonb, p_payments jsonb, p_sales_mode sales_mode DEFAULT 'retail'::sales_mode, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_org_id UUID;
  v_flags JSONB := '{}'::jsonb;
  v_payment JSONB;
  v_method payment_method;
  v_amount NUMERIC;
  v_payment_total NUMERIC := 0;
  v_result JSONB;
  v_order_id UUID;
  v_total NUMERIC;
  v_credit_count INT := 0;
  v_credit_amount NUMERIC := 0;
  v_payment_count INT;
  v_idx INT := 0;
  v_others NUMERIC := 0;
  v_last_amount NUMERIC;
  v_adjusted_payments JSONB := '[]'::jsonb;
  v_checkout_method payment_method;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_order_number TEXT;
  v_payment_status payment_status;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_payment_count := jsonb_array_length(p_payments);
  v_checkout_method := p_payment_method;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := (v_payment->>'method')::payment_method;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

    IF v_method = 'cash' AND COALESCE((v_flags->>'payment_cash')::boolean, true) = false THEN
      RAISE EXCEPTION 'Cash payments are disabled';
    END IF;
    IF v_method = 'card' AND COALESCE((v_flags->>'payment_card')::boolean, true) = false THEN
      RAISE EXCEPTION 'Card payments are disabled';
    END IF;
    IF v_method = 'other' AND COALESCE((v_flags->>'payment_other')::boolean, true) = false THEN
      RAISE EXCEPTION 'Other payments are disabled';
    END IF;
    IF v_method = 'wallet' AND COALESCE((v_flags->>'payment_wallet')::boolean, true) = false THEN
      RAISE EXCEPTION 'Wallet payments are disabled';
    END IF;
    IF v_method = 'credit' THEN
      v_credit_count := v_credit_count + 1;
      IF COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
        RAISE EXCEPTION 'Credit sales are disabled';
      END IF;
    END IF;

    v_payment_total := v_payment_total + v_amount;
  END LOOP;

  IF v_credit_count > 1 THEN
    RAISE EXCEPTION 'Only one credit payment line is allowed';
  END IF;

  IF v_credit_count > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
  END IF;

  IF v_credit_count > 0 AND v_payment_count > 1 THEN
    v_checkout_method := NULL;
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_method := (v_payment->>'method')::payment_method;
      IF v_method <> 'credit' THEN
        v_checkout_method := v_method;
        EXIT;
      END IF;
    END LOOP;
    IF v_checkout_method IS NULL THEN
      RAISE EXCEPTION 'Mixed credit sale requires a non-credit payment';
    END IF;
  END IF;

  v_result := public.complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    v_checkout_method,
    p_discount,
    p_lines,
    p_sales_mode,
    p_coupon_code
  );

  v_order_id := (v_result->>'order_id')::uuid;
  v_total := round((v_result->>'total')::numeric, 2);
  v_order_number := COALESCE(v_result->>'order_number', v_order_id::text);

  IF abs(round(v_payment_total, 2) - v_total) > 0.05 THEN
    RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
      v_payment_total, v_total;
  END IF;

  v_idx := 0;
  v_others := 0;
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_idx := v_idx + 1;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_idx < v_payment_count THEN
      v_others := v_others + v_amount;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_amount)
      );
    ELSE
      v_last_amount := round(v_total - v_others, 2);
      IF v_last_amount <= 0 THEN
        RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
          v_payment_total, v_total;
      END IF;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_last_amount)
      );
    END IF;
  END LOOP;

  DELETE FROM order_payments WHERE order_id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_adjusted_payments)
  LOOP
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (
      v_order_id,
      (v_payment->>'method')::payment_method,
      round((v_payment->>'amount')::numeric, 2)
    );
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_credit_amount
  FROM order_payments
  WHERE order_id = v_order_id AND method = 'credit';

  IF v_credit_amount > 0 AND v_payment_count > 1 THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_credit_amount) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
    ) VALUES (
      v_org_id, p_store_id, p_customer_id, 'credit_sale', v_credit_amount, 0, v_order_id, v_order_number, p_cashier_id
    );

    UPDATE customers
    SET account_balance = account_balance + v_credit_amount
    WHERE id = p_customer_id AND org_id = v_org_id;

    v_payment_status := 'partial';
  ELSIF v_credit_amount > 0 THEN
    v_payment_status := 'unpaid';
  ELSE
    v_payment_status := 'paid';
  END IF;

  UPDATE orders
  SET payment_status = v_payment_status
  WHERE id = v_order_id;

  RETURN v_result || jsonb_build_object(
    'payment_status', v_payment_status,
    'credit_amount', v_credit_amount
  );
END;
$function$;

-- Device-free replacement for complete_checkout_split_expired_override
CREATE OR REPLACE FUNCTION public.complete_checkout_split_expired_override(p_store_id uuid, p_session_id uuid, p_cashier_id uuid, p_customer_id uuid, p_payment_method payment_method, p_discount numeric, p_lines jsonb, p_payments jsonb, p_sales_mode sales_mode DEFAULT 'retail'::sales_mode, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_result JSONB;
  v_order_id UUID;
  v_total NUMERIC;
  v_payment JSONB;
  v_method payment_method;
  v_amount NUMERIC;
  v_payment_total NUMERIC := 0;
  v_flags JSONB := '{}'::jsonb;
  v_org_id UUID;
  v_credit_count INT := 0;
  v_credit_amount NUMERIC := 0;
  v_payment_count INT;
  v_idx INT := 0;
  v_others NUMERIC := 0;
  v_last_amount NUMERIC;
  v_adjusted_payments JSONB := '[]'::jsonb;
  v_checkout_method payment_method;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_order_number TEXT;
  v_payment_status payment_status;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_payment_count := jsonb_array_length(p_payments);
  v_checkout_method := p_payment_method;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := (v_payment->>'method')::payment_method;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

    IF v_method = 'cash' AND COALESCE((v_flags->>'payment_cash')::boolean, true) = false THEN
      RAISE EXCEPTION 'Cash payments are disabled';
    END IF;
    IF v_method = 'card' AND COALESCE((v_flags->>'payment_card')::boolean, true) = false THEN
      RAISE EXCEPTION 'Card payments are disabled';
    END IF;
    IF v_method = 'other' AND COALESCE((v_flags->>'payment_other')::boolean, true) = false THEN
      RAISE EXCEPTION 'Other payments are disabled';
    END IF;
    IF v_method = 'wallet' AND COALESCE((v_flags->>'payment_wallet')::boolean, true) = false THEN
      RAISE EXCEPTION 'Wallet payments are disabled';
    END IF;
    IF v_method = 'credit' THEN
      v_credit_count := v_credit_count + 1;
      IF COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
        RAISE EXCEPTION 'Credit sales are disabled';
      END IF;
    END IF;

    v_payment_total := v_payment_total + v_amount;
  END LOOP;

  IF v_credit_count > 1 THEN
    RAISE EXCEPTION 'Only one credit payment line is allowed';
  END IF;

  IF v_credit_count > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
  END IF;

  IF v_credit_count > 0 AND v_payment_count > 1 THEN
    v_checkout_method := NULL;
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_method := (v_payment->>'method')::payment_method;
      IF v_method <> 'credit' THEN
        v_checkout_method := v_method;
        EXIT;
      END IF;
    END LOOP;
    IF v_checkout_method IS NULL THEN
      RAISE EXCEPTION 'Mixed credit sale requires a non-credit payment';
    END IF;
  END IF;

  v_result := public.complete_checkout_expired_override(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    v_checkout_method,
    p_discount,
    p_lines,
    p_sales_mode,
    p_coupon_code
  );

  v_order_id := (v_result->>'order_id')::uuid;
  v_total := round((v_result->>'total')::numeric, 2);
  v_order_number := COALESCE(v_result->>'order_number', v_order_id::text);

  IF abs(round(v_payment_total, 2) - v_total) > 0.05 THEN
    RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
      v_payment_total, v_total;
  END IF;

  v_idx := 0;
  v_others := 0;
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_idx := v_idx + 1;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_idx < v_payment_count THEN
      v_others := v_others + v_amount;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_amount)
      );
    ELSE
      v_last_amount := round(v_total - v_others, 2);
      IF v_last_amount <= 0 THEN
        RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
          v_payment_total, v_total;
      END IF;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_last_amount)
      );
    END IF;
  END LOOP;

  DELETE FROM order_payments WHERE order_id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_adjusted_payments)
  LOOP
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (
      v_order_id,
      (v_payment->>'method')::payment_method,
      round((v_payment->>'amount')::numeric, 2)
    );
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_credit_amount
  FROM order_payments
  WHERE order_id = v_order_id AND method = 'credit';

  IF v_credit_amount > 0 AND v_payment_count > 1 THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_credit_amount) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
    ) VALUES (
      v_org_id, p_store_id, p_customer_id, 'credit_sale', v_credit_amount, 0, v_order_id, v_order_number, p_cashier_id
    );

    UPDATE customers
    SET account_balance = account_balance + v_credit_amount
    WHERE id = p_customer_id AND org_id = v_org_id;

    v_payment_status := 'partial';
  ELSIF v_credit_amount > 0 THEN
    v_payment_status := 'unpaid';
  ELSE
    v_payment_status := 'paid';
  END IF;

  UPDATE orders
  SET payment_status = v_payment_status
  WHERE id = v_order_id;

  RETURN v_result || jsonb_build_object(
    'payment_status', v_payment_status,
    'credit_amount', v_credit_amount
  );
END;
$function$;

-- Device-free replacement for complete_checkout_split
CREATE OR REPLACE FUNCTION public.complete_checkout_split(p_store_id uuid, p_session_id uuid, p_cashier_id uuid, p_customer_id uuid, p_payment_method payment_method, p_discount numeric, p_lines jsonb, p_payments jsonb, p_sales_mode sales_mode DEFAULT 'retail'::sales_mode, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_role user_role;
  v_settings JSONB := '{}'::jsonb;
  v_threshold NUMERIC;
  v_threshold_text TEXT;
BEGIN
  v_org_id := auth_org_id();
  v_caller := auth_app_user_id();
  IF v_org_id IS NULL OR v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT role INTO v_role
  FROM users
  WHERE id = v_caller AND org_id = v_org_id AND is_active = true;
  IF v_role IS NULL OR NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Checkout permission required';
  END IF;
  IF p_cashier_id IS DISTINCT FROM v_caller AND v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Cashier mismatch';
  END IF;
  IF COALESCE(p_discount, 0) < 0 THEN RAISE EXCEPTION 'Discount cannot be negative'; END IF;

  SELECT COALESCE(value, '{}'::jsonb) INTO v_settings
  FROM app_settings
  WHERE org_id = v_org_id AND key = 'session_settings'
  LIMIT 1;
  v_threshold_text := v_settings->>'manager_discount_override_amount';
  IF v_threshold_text IS NOT NULL AND v_threshold_text ~ '^[0-9]+([.][0-9]+)?$' THEN
    v_threshold := v_threshold_text::numeric;
  END IF;
  IF v_threshold IS NOT NULL AND COALESCE(p_discount, 0) > v_threshold
     AND v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Manager discount override required';
  END IF;

  RETURN public.complete_checkout_split_core(
    p_store_id, p_session_id, p_cashier_id, p_customer_id, p_payment_method,
    COALESCE(p_discount, 0), p_lines, p_payments, p_sales_mode,
    p_coupon_code
  );
END;
$function$;

-- Device-free replacement for complete_checkout
CREATE OR REPLACE FUNCTION public.complete_checkout(p_store_id uuid, p_session_id uuid, p_cashier_id uuid, p_customer_id uuid, p_payment_method payment_method, p_discount numeric, p_lines jsonb, p_sales_mode sales_mode DEFAULT 'retail'::sales_mode, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_role user_role;
  v_settings JSONB := '{}'::jsonb;
  v_threshold NUMERIC;
  v_threshold_text TEXT;
BEGIN
  v_org_id := auth_org_id();
  v_caller := auth_app_user_id();
  IF v_org_id IS NULL OR v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT role
  INTO v_role
  FROM users
  WHERE id = v_caller
    AND org_id = v_org_id
    AND is_active = true;

  IF v_role IS NULL OR NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Checkout permission required';
  END IF;

  IF p_cashier_id IS DISTINCT FROM v_caller
     AND v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Cashier mismatch';
  END IF;

  IF COALESCE(p_discount, 0) < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  SELECT COALESCE(value, '{}'::jsonb)
  INTO v_settings
  FROM app_settings
  WHERE org_id = v_org_id
    AND key = 'session_settings'
  LIMIT 1;

  v_threshold_text := v_settings->>'manager_discount_override_amount';
  IF v_threshold_text IS NOT NULL
     AND v_threshold_text ~ '^[0-9]+([.][0-9]+)?$' THEN
    v_threshold := v_threshold_text::numeric;
  END IF;

  IF v_threshold IS NOT NULL
     AND COALESCE(p_discount, 0) > v_threshold
     AND v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Manager discount override required';
  END IF;

  RETURN public.complete_checkout_core(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    COALESCE(p_discount, 0),
    p_lines,
    p_sales_mode,
    p_coupon_code
  );
END;
$function$;

-- Device-free replacement for invoice_online_order_checkout
CREATE OR REPLACE FUNCTION public.invoice_online_order_checkout(p_online_order_id uuid, p_session_id uuid, p_cashier_id uuid, p_customer_id uuid, p_payment_method payment_method, p_payments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_online public.online_orders%ROWTYPE;
  v_lines JSONB;
  v_result JSONB;
BEGIN
  SELECT * INTO v_online
  FROM online_orders
  WHERE id = p_online_order_id
  FOR UPDATE;
  IF v_online.id IS NULL OR NOT has_store_access(v_online.store_id) THEN
    RAISE EXCEPTION 'Online order not found';
  END IF;
  IF v_online.status = 'cancelled' THEN RAISE EXCEPTION 'Online order is cancelled'; END IF;

  -- The row lock makes retries idempotent. A completed earlier attempt returns
  -- its existing invoice rather than creating another one.
  IF v_online.order_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'order_id', o.id,
      'order_number', o.order_number,
      'subtotal', o.subtotal,
      'tax', o.tax,
      'total', o.total,
      'idempotent_replay', true
    ) INTO v_result
    FROM orders o WHERE o.id = v_online.order_id;
    RETURN v_result;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'product_id', i.product_id,
    'variant_id', i.variant_id,
    'quantity', i.quantity
  ) ORDER BY i.created_at, i.id)
  INTO v_lines
  FROM online_order_items i
  WHERE i.online_order_id = p_online_order_id;
  IF COALESCE(jsonb_array_length(v_lines), 0) = 0 THEN
    RAISE EXCEPTION 'Online order has no items';
  END IF;

  PERFORM set_online_order_reservation(p_online_order_id, false, p_cashier_id);

  IF p_payments IS NOT NULL AND jsonb_array_length(p_payments) > 1 THEN
    v_result := complete_checkout_split(
      v_online.store_id, p_session_id, p_cashier_id, p_customer_id,
      p_payment_method, 0, v_lines, p_payments, 'retail', NULL
    );
  ELSE
    v_result := complete_checkout(
      v_online.store_id, p_session_id, p_cashier_id, p_customer_id,
      p_payment_method, 0, v_lines, 'retail', NULL
    );
  END IF;

  UPDATE online_orders
  SET status = 'invoiced', order_id = (v_result->>'order_id')::uuid
  WHERE id = p_online_order_id;

  RETURN v_result;
END;
$function$;

-- Device-free replacement for verify_manager_override_pin
CREATE OR REPLACE FUNCTION public.verify_manager_override_pin(p_store_id uuid, p_pin text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  rec RECORD;
  v_org_id UUID;
  v_attempt_user UUID;
  v_recent_failures INT;
BEGIN
  v_org_id := auth_org_id(); v_attempt_user := auth_app_user_id();
  IF v_org_id IS NULL OR v_attempt_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT has_store_access(p_store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8 OR trim(p_pin) !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;
  SELECT COUNT(*) INTO v_recent_failures FROM pin_attempts
  WHERE org_id = v_org_id AND store_id = p_store_id AND attempted_by = v_attempt_user
    AND success = false AND created_at > now() - interval '10 minutes';
  IF v_recent_failures >= 5 THEN RAISE EXCEPTION 'Too many failed PIN attempts. Try again later.'; END IF;
  FOR rec IN
    SELECT u.id, pc.pin_hash FROM users u
    JOIN pin_codes pc ON pc.user_id = u.id AND pc.is_active = true
    WHERE u.org_id = v_org_id AND u.role IN ('owner', 'manager') AND u.is_active = true
      AND (u.role = 'owner' OR EXISTS (
        SELECT 1 FROM user_store_access usa WHERE usa.user_id = u.id AND usa.store_id = p_store_id
      ))
  LOOP
    IF rec.pin_hash = extensions.crypt(trim(p_pin), rec.pin_hash) THEN
      INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
      VALUES (v_org_id, p_store_id, v_attempt_user, true);
      RETURN rec.id;
    END IF;
  END LOOP;
  INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
  VALUES (v_org_id, p_store_id, v_attempt_user, false);
  RAISE EXCEPTION 'Invalid PIN';
END;
$function$;

-- Device-free replacement for initialize_organization
CREATE OR REPLACE FUNCTION public.initialize_organization(p_org_name text, p_logo_url text, p_currency text, p_timezone text, p_country text, p_store_name text, p_store_code text, p_store_address text, p_store_phone text, p_store_timezone text, p_tax_enabled boolean, p_tax_rate numeric, p_tax_inclusive boolean, p_receipt_header text, p_receipt_footer text, p_feature_flags jsonb, p_business_activity jsonb DEFAULT '{}'::jsonb, p_session_settings jsonb DEFAULT '{}'::jsonb, p_expense_settings jsonb DEFAULT '{}'::jsonb, p_payment_methods jsonb DEFAULT '{}'::jsonb, p_prevent_negative_stock boolean DEFAULT true, p_default_tax_behavior text DEFAULT 'inclusive'::text, p_seed_defaults jsonb DEFAULT '{}'::jsonb, p_owner_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_org_id UUID;
  v_store_id UUID;
  v_flags JSONB;
  v_defaults JSONB;
  v_business_defaults JSONB;
  v_session_defaults JSONB;
  v_expense_defaults JSONB;
BEGIN
  IF p_owner_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM users
    WHERE role = 'owner'
      AND lower(email) = lower(trim(p_owner_email))
  ) THEN
    RAISE EXCEPTION 'OWNER_EMAIL_ALREADY_USED' USING ERRCODE = 'P0001';
  END IF;

  v_org_id := gen_random_uuid();
  v_store_id := gen_random_uuid();

  INSERT INTO organizations (id, name, logo_url, currency, timezone, country, settings)
  VALUES (
    v_org_id,
    p_org_name,
    NULLIF(trim(p_logo_url), ''),
    COALESCE(NULLIF(trim(p_currency), ''), 'EGP'),
    COALESCE(NULLIF(trim(p_timezone), ''), 'Africa/Cairo'),
    COALESCE(p_country, ''),
    jsonb_build_object(
      'tax_rate', COALESCE(p_tax_rate, 0),
      'tax_inclusive',
        CASE WHEN p_default_tax_behavior = 'exclusive' THEN false ELSE COALESCE(p_tax_inclusive, true) END,
      'tax_enabled', COALESCE(p_tax_enabled, false)
    )
  );

  INSERT INTO stores (id, org_id, name, code, address, phone, timezone, is_active, settings)
  VALUES (
    v_store_id,
    v_org_id,
    p_store_name,
    COALESCE(NULLIF(trim(p_store_code), ''), slugify_store_name(p_store_name, 'main')),
    COALESCE(p_store_address, ''),
    COALESCE(p_store_phone, ''),
    NULLIF(trim(p_store_timezone), ''),
    true,
    '{}'::jsonb
  );

  v_defaults := COALESCE(p_seed_defaults, '{}'::jsonb);
  IF COALESCE((v_defaults->>'cost_centers')::boolean, true) THEN
    INSERT INTO cost_centers (org_id, name, code, type) VALUES
      (v_org_id, 'المرافق', 'UTIL', 'utilities'),
      (v_org_id, 'النظافة', 'CLEAN', 'cleaning'),
      (v_org_id, 'التعبئة والتغليف', 'PACK', 'packaging'),
      (v_org_id, 'الصيانة', 'MAINT', 'maintenance'),
      (v_org_id, 'الرواتب', 'SAL', 'salaries'),
      (v_org_id, 'مستلزمات الفرع', 'SUP', 'operations'),
      (v_org_id, 'التوصيل', 'DEL', 'operations'),
      (v_org_id, 'متنوع', 'MISC', 'other')
    ON CONFLICT (org_id, code) DO NOTHING;
  END IF;

  IF COALESCE((v_defaults->>'expense_categories')::boolean, true) THEN
    INSERT INTO expense_categories (org_id, cost_center_id, name, requires_inventory_item)
    SELECT v_org_id, cc.id, x.name, x.requires_inventory_item
    FROM (VALUES
      ('UTIL', 'كهرباء', false), ('UTIL', 'مياه', false), ('UTIL', 'إنترنت', false),
      ('CLEAN', 'أدوات نظافة', false), ('CLEAN', 'منظفات', false), ('CLEAN', 'أكياس قمامة', false),
      ('CLEAN', 'خدمة نظافة', false), ('PACK', 'أكواب', true), ('PACK', 'ملاعق', true), ('PACK', 'مناديل', true),
      ('MAINT', 'إصلاحات', false), ('SAL', 'مرتبات', false), ('MISC', 'أخرى', false),
      ('MISC', 'نثرية', false), ('MISC', 'مستلزمات', false)
    ) AS x(cost_code, name, requires_inventory_item)
    JOIN cost_centers cc ON cc.org_id = v_org_id AND cc.code = x.cost_code
    ON CONFLICT (org_id, cost_center_id, name) DO NOTHING;
  END IF;

  IF COALESCE((v_defaults->>'product_categories')::boolean, true) THEN
    INSERT INTO categories (org_id, name, sort_order, color, icon) VALUES
      (v_org_id, 'Hot Drinks', 1, '#DC2626', 'coffee'),
      (v_org_id, 'Cold Drinks', 2, '#2563EB', 'cup-soda'),
      (v_org_id, 'Ice Cream', 3, '#60A5FA', 'ice-cream'),
      (v_org_id, 'Desserts', 4, '#F472B6', 'cake'),
      (v_org_id, 'Waffle', 5, '#F59E0B', 'grid-2x2'),
      (v_org_id, 'Crepe', 6, '#A78BFA', 'layers'),
      (v_org_id, 'Add-ons', 7, '#34D399', 'sparkles');
  END IF;

  INSERT INTO role_permissions (org_id, role, permission_key)
  SELECT v_org_id, 'owner', key FROM permissions ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (org_id, role, permission_key)
  SELECT v_org_id, 'manager', key FROM permissions
  WHERE key NOT IN ('monthly_closing_reopen', 'user_manage') ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (org_id, role, permission_key) VALUES
    (v_org_id, 'manager', 'expense_create'), (v_org_id, 'manager', 'expense_edit'),
    (v_org_id, 'manager', 'expense_delete'), (v_org_id, 'manager', 'expense_view_all'),
    (v_org_id, 'manager', 'expense_approve'), (v_org_id, 'manager', 'expense_category_manage'),
    (v_org_id, 'manager', 'session_expense_create'), (v_org_id, 'manager', 'purchase_from_session_create'),
    (v_org_id, 'cashier', 'pos_access'), (v_org_id, 'cashier', 'checkout_create'),
    (v_org_id, 'cashier', 'order_view'), (v_org_id, 'cashier', 'session_open'),
    (v_org_id, 'cashier', 'session_close'), (v_org_id, 'cashier', 'session_view'),
    (v_org_id, 'cashier', 'session_expense_create'), (v_org_id, 'cashier', 'purchase_from_session_create'),
    (v_org_id, 'inventory', 'product_manage'), (v_org_id, 'inventory', 'recipe_manage'),
    (v_org_id, 'inventory', 'inventory_view'), (v_org_id, 'inventory', 'purchase_manage'),
    (v_org_id, 'inventory', 'transfer_manage'), (v_org_id, 'inventory', 'waste_manage'),
    (v_org_id, 'inventory', 'stock_count_manage')
  ON CONFLICT DO NOTHING;

  INSERT INTO warehouses (org_id, store_id, name, is_default, is_active)
  VALUES (v_org_id, v_store_id, 'Main warehouse', true, true) ON CONFLICT DO NOTHING;

  v_flags := jsonb_build_object(
    'receipt_printing', true, 'barcode_scanner', true, 'inventory_deduction', true, 'loyalty', true,
    'customer_discounts', false, 'reports', true, 'imports_exports', true, 'cash_drawer', false,
    'dark_mode', true, 'tax', true, 'payment_cash', true, 'payment_card', true, 'payment_wallet', true,
    'payment_other', true, 'prevent_negative_stock', true, 'session_expenses', true, 'refunds', false,
    'stock_count', true, 'transfers', true, 'purchases', true, 'waste', true, 'recipes', false,
    'credit_sales', false, 'supermarket_mode', false, 'weight_sales', false, 'price_by_amount', false,
    'wholesale_sales', false, 'product_price_tiers', false, 'fixed_weight_variants', false
  );

  v_flags := v_flags || COALESCE(p_feature_flags, '{}'::jsonb) || jsonb_build_object(
    'payment_cash', COALESCE((p_payment_methods->>'payment_cash')::boolean, (v_flags->>'payment_cash')::boolean),
    'payment_card', COALESCE((p_payment_methods->>'payment_card')::boolean, (v_flags->>'payment_card')::boolean),
    'payment_wallet', COALESCE((p_payment_methods->>'payment_wallet')::boolean, (v_flags->>'payment_wallet')::boolean),
    'payment_other', COALESCE((p_payment_methods->>'payment_other')::boolean, (v_flags->>'payment_other')::boolean),
    'credit_sales', COALESCE((p_payment_methods->>'payment_credit')::boolean, (v_flags->>'credit_sales')::boolean),
    'prevent_negative_stock', COALESCE(p_prevent_negative_stock, true)
  );

  v_business_defaults := jsonb_build_object(
    'activity_type', 'cafe', 'enabled_sales_modes', jsonb_build_array('retail'),
    'default_sales_mode', 'retail', 'enable_weight_sales', false, 'enable_piece_sales', true,
    'enable_wholesale_sales', false, 'enable_variants', true, 'enable_price_by_amount', false,
    'allow_cashier_wholesale', false, 'require_manager_for_wholesale', true,
    'auto_apply_wholesale_by_quantity', false
  ) || COALESCE(p_business_activity, '{}'::jsonb);

  v_session_defaults := jsonb_build_object(
    'max_open_hours', 24, 'warn_after_hours', 20, 'block_sales_when_expired', true,
    'require_manager_override_for_expired_sale', true, 'allow_manager_force_close', true
  ) || COALESCE(p_session_settings, '{}'::jsonb);

  v_expense_defaults := jsonb_build_object(
    'approval_required', false, 'cashier_can_add_session_expense', true,
    'cashier_max_expense_amount', null, 'allow_inventory_purchase_from_session', true,
    'default_cost_center_packaging', null, 'default_cost_center_cleaning', null,
    'default_cost_center_utilities', null, 'prevent_expenses_in_closed_periods', false
  ) || COALESCE(p_expense_settings, '{}'::jsonb);

  INSERT INTO app_settings (org_id, key, value) VALUES
    (v_org_id, 'feature_flags', v_flags),
    (v_org_id, 'tax_rate', jsonb_build_object('rate', COALESCE(p_tax_rate, 0))),
    (v_org_id, 'session_settings', v_session_defaults),
    (v_org_id, 'expense_settings', v_expense_defaults),
    (v_org_id, 'business_activity', v_business_defaults),
    (v_org_id, 'inventory_units', jsonb_build_array('piece', 'kg', 'gram', 'liter', 'ml')),
    (v_org_id, 'receipt_footer', jsonb_build_object('text', COALESCE(p_receipt_footer, ''))),
    (v_org_id, 'receipt_header', jsonb_build_object('text', COALESCE(p_receipt_header, '')))
  ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value;

  IF COALESCE((v_defaults->>'inventory_units')::boolean, true) = false THEN
    DELETE FROM app_settings WHERE org_id = v_org_id AND key = 'inventory_units';
  END IF;

  RETURN jsonb_build_object('org_id', v_org_id, 'store_id', v_store_id);
END;
$function$;
-- Remove every legacy overload only after the replacements exist.
DROP FUNCTION IF EXISTS public.invoice_online_order_checkout(uuid,uuid,uuid,uuid,payment_method,jsonb,uuid);
DROP FUNCTION IF EXISTS public.complete_checkout_split_expired_override(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,uuid,sales_mode,text);
DROP FUNCTION IF EXISTS public.complete_checkout_split(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,uuid,sales_mode,text);
DROP FUNCTION IF EXISTS public.complete_checkout_split_core(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,uuid,sales_mode,text);
DROP FUNCTION IF EXISTS public.complete_checkout_expired_override(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,uuid,sales_mode,text);
DROP FUNCTION IF EXISTS public.complete_checkout(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,uuid,sales_mode,text);
DROP FUNCTION IF EXISTS public.complete_checkout_core(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,uuid,sales_mode,text);
DROP FUNCTION IF EXISTS public.verify_manager_override_pin(uuid,text,uuid);
DROP FUNCTION IF EXISTS public.login_cashier_by_pin(uuid,uuid,uuid,text);
DROP FUNCTION IF EXISTS public.verify_cashier_pin(uuid,text,uuid);
DROP FUNCTION IF EXISTS public.create_device_pairing_code(uuid);
DROP FUNCTION IF EXISTS public.consume_device_pairing_code(text);
DROP FUNCTION IF EXISTS public.record_device_pairing_attempt(uuid,boolean);
DROP FUNCTION IF EXISTS public.assert_device_pairing_rate_limit(uuid);
DROP FUNCTION IF EXISTS public.cashier_can_use_device(uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.touch_device_seen(uuid);

ALTER TABLE public.cashier_sessions DROP COLUMN IF EXISTS device_id;
ALTER TABLE public.pos_held_carts DROP COLUMN IF EXISTS device_id;

DROP TABLE IF EXISTS public.device_pairing_attempts;
DROP TABLE IF EXISTS public.device_pairing_codes;
DROP TABLE IF EXISTS public.user_device_access;
DROP TABLE IF EXISTS public.devices;

UPDATE public.app_settings
SET value = value - 'max_devices'
WHERE key = 'platform_plan' AND value ? 'max_devices';

REVOKE ALL ON FUNCTION public.verify_manager_override_pin(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_manager_override_pin(uuid,text) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_checkout_core(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,sales_mode,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_checkout_expired_override(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,sales_mode,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_checkout_split_core(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,sales_mode,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_checkout_split_expired_override(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,sales_mode,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_checkout_split(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,sales_mode,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_checkout(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,sales_mode,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invoice_online_order_checkout(uuid,uuid,uuid,uuid,payment_method,jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_checkout_core(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,sales_mode,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_checkout_expired_override(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,sales_mode,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_checkout_split_core(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,sales_mode,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_checkout_split_expired_override(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,sales_mode,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_checkout_split(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,jsonb,sales_mode,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_checkout(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,sales_mode,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_online_order_checkout(uuid,uuid,uuid,uuid,payment_method,jsonb) TO authenticated;
