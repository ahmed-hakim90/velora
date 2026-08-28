-- Multi-theme storefront foundation. Presentation stays in the app theme registry;
-- the database stores only versioned configuration, entitlements and typed catalog data.

DO $$ BEGIN
  CREATE TYPE storefront_attribute_type AS ENUM ('number', 'range', 'enum', 'multi_select', 'boolean');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS show_on_storefront boolean NOT NULL DEFAULT false;
UPDATE products
SET show_on_storefront = show_on_online_menu
WHERE show_on_storefront = false AND show_on_online_menu = true;
COMMENT ON COLUMN products.show_on_storefront IS
  'Independent public storefront visibility. It does not follow show_on_online_menu after migration.';

CREATE UNIQUE INDEX IF NOT EXISTS stores_storefront_slug_lower_uidx
  ON stores ((lower(settings->>'storefront_slug')))
  WHERE coalesce(settings->>'storefront_slug', '') <> '';

ALTER TABLE online_public_rate_events
  DROP CONSTRAINT IF EXISTS online_public_rate_events_action_check;
ALTER TABLE online_public_rate_events
  ADD CONSTRAINT online_public_rate_events_action_check CHECK (
    action IN ('menu', 'order_create', 'storefront_read', 'storefront_order_create', 'pos_pin_login')
  );

CREATE OR REPLACE FUNCTION public.assert_and_record_online_public_rate_limit(
  p_bucket_key TEXT,
  p_action TEXT,
  p_max_events INT DEFAULT 30,
  p_window_seconds INT DEFAULT 60
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_key TEXT := left(trim(coalesce(p_bucket_key, '')), 200);
  v_action TEXT := trim(coalesce(p_action, ''));
  v_max INT := GREATEST(1, LEAST(coalesce(p_max_events, 30), 500));
  v_window INT := GREATEST(5, LEAST(coalesce(p_window_seconds, 60), 3600));
BEGIN
  IF v_key = '' THEN RAISE EXCEPTION 'Rate limit bucket required'; END IF;
  IF v_action NOT IN ('menu', 'order_create', 'storefront_read', 'storefront_order_create', 'pos_pin_login') THEN
    RAISE EXCEPTION 'Invalid rate limit action';
  END IF;
  SELECT COUNT(*)::INT INTO v_count
  FROM online_public_rate_events
  WHERE bucket_key = v_key AND action = v_action
    AND created_at > now() - make_interval(secs => v_window);
  IF v_count >= v_max THEN RAISE EXCEPTION 'Too many requests. Try again later.'; END IF;
  INSERT INTO online_public_rate_events (bucket_key, action) VALUES (v_key, v_action);
  DELETE FROM online_public_rate_events
  WHERE bucket_key = v_key AND action = v_action
    AND created_at <= now() - make_interval(secs => v_window * 4);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_and_record_online_public_rate_limit(TEXT, TEXT, INT, INT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_and_record_online_public_rate_limit(TEXT, TEXT, INT, INT)
  TO service_role;

CREATE TABLE IF NOT EXISTS attribute_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  type storefront_attribute_type NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  filterable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attribute_definitions_key_format CHECK (key ~ '^[a-z][a-z0-9_]{1,49}$'),
  CONSTRAINT attribute_definitions_org_key_unique UNIQUE (org_id, key),
  CONSTRAINT attribute_definitions_options_array CHECK (jsonb_typeof(options) = 'array')
);

CREATE TABLE IF NOT EXISTS product_attribute_values (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, definition_id)
);

-- Storefront-only presentation. Products remain the operational source of truth.
CREATE TABLE IF NOT EXISTS storefront_product_content (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_product_content_specifications_array CHECK (jsonb_typeof(specifications) = 'array')
);

CREATE TABLE IF NOT EXISTS storefront_product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_product_media_url_check CHECK (url ~ '^https?://')
);

CREATE TABLE IF NOT EXISTS storefront_product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  compare_at_price numeric(14,2) CHECK (compare_at_price IS NULL OR compare_at_price >= price),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_product_prices_window_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS storefront_product_prices_scope_uidx
  ON storefront_product_prices (org_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), product_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS storefront_product_media_product_idx
  ON storefront_product_media (product_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS storefront_product_prices_lookup_idx
  ON storefront_product_prices (org_id, store_id, product_id, variant_id) WHERE is_active = true;

-- One customer master record, with reusable addresses shared by every sales channel.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS first_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'المنزل',
  recipient_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address_line text NOT NULL,
  area text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx
  ON customer_addresses (customer_id, is_default DESC, last_used_at DESC);

CREATE TABLE IF NOT EXISTS storefront_customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('google', 'apple', 'facebook')),
  email text,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_customer_accounts_org_auth_unique UNIQUE (org_id, auth_user_id)
);
CREATE INDEX IF NOT EXISTS storefront_customer_accounts_customer_idx
  ON storefront_customer_accounts (customer_id) WHERE customer_id IS NOT NULL;

DO $$ BEGIN
  CREATE TYPE storefront_order_status AS ENUM (
    'pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped',
    'delivered', 'cancelled', 'returned', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE storefront_payment_status AS ENUM (
    'pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS storefront_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('SF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  tracking_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  org_id uuid NOT NULL REFERENCES organizations(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  status storefront_order_status NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'cash_on_delivery',
  payment_status storefront_payment_status NOT NULL DEFAULT 'pending',
  fulfillment_type text NOT NULL CHECK (fulfillment_type IN ('pickup', 'delivery')),
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_zone_id text,
  delivery_area text NOT NULL DEFAULT '',
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  discount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (shipping_total >= 0),
  tax_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  grand_total numeric(14,2) NOT NULL CHECK (grand_total >= 0),
  currency text NOT NULL,
  coupon_code text,
  customer_notes text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',
  placed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_orders_customer_name_check CHECK (length(trim(customer_name)) BETWEEN 2 AND 120),
  CONSTRAINT storefront_orders_customer_phone_check CHECK (length(trim(customer_phone)) BETWEEN 5 AND 40)
);

CREATE TABLE IF NOT EXISTS storefront_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES storefront_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  variant_id uuid REFERENCES product_variants(id),
  sku text NOT NULL DEFAULT '',
  product_name text NOT NULL,
  variant_name text,
  image_url text,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  list_unit_price numeric(14,2) NOT NULL CHECK (list_unit_price >= 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_total numeric(14,2) NOT NULL CHECK (line_total >= 0),
  attributes_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storefront_orders_org_status_created_idx
  ON storefront_orders (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS storefront_orders_store_status_created_idx
  ON storefront_orders (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS storefront_orders_customer_phone_idx
  ON storefront_orders (org_id, customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS storefront_order_items_order_idx
  ON storefront_order_items (order_id);
CREATE INDEX IF NOT EXISTS storefront_order_items_product_idx
  ON storefront_order_items (product_id);

ALTER TABLE storefront_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS storefront_orders_org_access ON storefront_orders;
CREATE POLICY storefront_orders_org_access ON storefront_orders FOR ALL
  USING (org_id = auth_org_id() AND has_store_access(store_id))
  WITH CHECK (org_id = auth_org_id() AND has_store_access(store_id));
DROP POLICY IF EXISTS storefront_order_items_org_access ON storefront_order_items;
CREATE POLICY storefront_order_items_org_access ON storefront_order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM storefront_orders so
    WHERE so.id = storefront_order_items.order_id
      AND so.org_id = auth_org_id() AND has_store_access(so.store_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM storefront_orders so
    WHERE so.id = storefront_order_items.order_id
      AND so.org_id = auth_org_id() AND has_store_access(so.store_id)
  ));

CREATE INDEX IF NOT EXISTS product_attribute_values_org_definition_idx
  ON product_attribute_values (org_id, definition_id);
CREATE INDEX IF NOT EXISTS product_attribute_values_value_gin_idx
  ON product_attribute_values USING gin (value jsonb_path_ops);

CREATE OR REPLACE FUNCTION validate_product_attribute_value() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_definition attribute_definitions%ROWTYPE;
  v_product_org uuid;
BEGIN
  SELECT * INTO v_definition FROM attribute_definitions WHERE id = NEW.definition_id;
  SELECT org_id INTO v_product_org FROM products WHERE id = NEW.product_id;
  IF v_definition.id IS NULL OR v_product_org IS NULL OR v_definition.org_id <> v_product_org THEN
    RAISE EXCEPTION 'Attribute definition and product must belong to the same organization';
  END IF;
  NEW.org_id := v_product_org;
  IF (v_definition.type = 'number' AND jsonb_typeof(NEW.value) <> 'number')
    OR (v_definition.type = 'boolean' AND jsonb_typeof(NEW.value) <> 'boolean')
    OR (v_definition.type IN ('enum', 'multi_select') AND jsonb_typeof(NEW.value) NOT IN ('string', 'array'))
    OR (v_definition.type = 'range' AND (
      jsonb_typeof(NEW.value) <> 'object'
      OR jsonb_typeof(NEW.value->'min') <> 'number'
      OR jsonb_typeof(NEW.value->'max') <> 'number'
      OR (NEW.value->>'min')::numeric > (NEW.value->>'max')::numeric
    )) THEN RAISE EXCEPTION 'Invalid value for attribute type %', v_definition.type;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS product_attribute_values_validate ON product_attribute_values;
CREATE TRIGGER product_attribute_values_validate BEFORE INSERT OR UPDATE ON product_attribute_values
FOR EACH ROW EXECUTE FUNCTION validate_product_attribute_value();

ALTER TABLE attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_product_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_customer_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attribute_definitions_org_access ON attribute_definitions;
CREATE POLICY attribute_definitions_org_access ON attribute_definitions FOR ALL
  USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());
DROP POLICY IF EXISTS product_attribute_values_org_access ON product_attribute_values;
CREATE POLICY product_attribute_values_org_access ON product_attribute_values FOR ALL
  USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS storefront_product_content_org_access ON storefront_product_content;
CREATE POLICY storefront_product_content_org_access ON storefront_product_content FOR ALL
  USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());
DROP POLICY IF EXISTS storefront_product_media_org_access ON storefront_product_media;
CREATE POLICY storefront_product_media_org_access ON storefront_product_media FOR ALL
  USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());
DROP POLICY IF EXISTS storefront_product_prices_org_access ON storefront_product_prices;
CREATE POLICY storefront_product_prices_org_access ON storefront_product_prices FOR ALL
  USING (org_id = auth_org_id() AND (store_id IS NULL OR has_store_access(store_id)))
  WITH CHECK (org_id = auth_org_id() AND (store_id IS NULL OR has_store_access(store_id)));
DROP POLICY IF EXISTS customer_addresses_org_access ON customer_addresses;
CREATE POLICY customer_addresses_org_access ON customer_addresses FOR ALL
  USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());
DROP POLICY IF EXISTS storefront_customer_accounts_self_access ON storefront_customer_accounts;
CREATE POLICY storefront_customer_accounts_self_access ON storefront_customer_accounts FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE OR REPLACE FUNCTION validate_storefront_extension_ownership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product_org uuid; v_variant_product uuid; v_store_org uuid;
BEGIN
  SELECT org_id INTO v_product_org FROM products WHERE id = NEW.product_id;
  IF v_product_org IS NULL OR NEW.org_id <> v_product_org THEN
    RAISE EXCEPTION 'Storefront extension and product must belong to the same organization';
  END IF;
  IF TG_TABLE_NAME = 'storefront_product_prices' THEN
    IF NEW.variant_id IS NOT NULL THEN
      SELECT product_id INTO v_variant_product FROM product_variants WHERE id = NEW.variant_id;
      IF v_variant_product IS DISTINCT FROM NEW.product_id THEN RAISE EXCEPTION 'Variant does not belong to product'; END IF;
    END IF;
    IF NEW.store_id IS NOT NULL THEN
      SELECT org_id INTO v_store_org FROM stores WHERE id = NEW.store_id;
      IF v_store_org IS DISTINCT FROM NEW.org_id THEN RAISE EXCEPTION 'Store does not belong to organization'; END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS storefront_product_content_ownership ON storefront_product_content;
CREATE TRIGGER storefront_product_content_ownership BEFORE INSERT OR UPDATE ON storefront_product_content
FOR EACH ROW EXECUTE FUNCTION validate_storefront_extension_ownership();
DROP TRIGGER IF EXISTS storefront_product_media_ownership ON storefront_product_media;
CREATE TRIGGER storefront_product_media_ownership BEFORE INSERT OR UPDATE ON storefront_product_media
FOR EACH ROW EXECUTE FUNCTION validate_storefront_extension_ownership();
DROP TRIGGER IF EXISTS storefront_product_prices_ownership ON storefront_product_prices;
CREATE TRIGGER storefront_product_prices_ownership BEFORE INSERT OR UPDATE ON storefront_product_prices
FOR EACH ROW EXECUTE FUNCTION validate_storefront_extension_ownership();

CREATE OR REPLACE FUNCTION validate_customer_address_ownership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_org uuid;
BEGIN
  SELECT org_id INTO v_customer_org FROM customers WHERE id = NEW.customer_id;
  IF v_customer_org IS NULL OR v_customer_org <> NEW.org_id THEN
    RAISE EXCEPTION 'Address and customer must belong to the same organization';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS customer_addresses_ownership ON customer_addresses;
CREATE TRIGGER customer_addresses_ownership BEFORE INSERT OR UPDATE ON customer_addresses
FOR EACH ROW EXECUTE FUNCTION validate_customer_address_ownership();

COMMENT ON COLUMN stores.settings IS
  'Versioned store settings. Storefront keys are isolated: storefront_enabled, storefront_ordering_enabled, storefront_slug, storefront_unlisted, storefront_token, storefront_hours, storefront_fulfillment, storefront_brand, storefront_draft, storefront_published, storefront_preview_token, storefront_preview_expires_at.';

-- Seed the default typed toy-store attributes for existing organizations without coupling products to toys.
INSERT INTO attribute_definitions (org_id, key, name, type, options, sort_order)
SELECT o.id, seed.key, seed.name, seed.type::storefront_attribute_type, seed.options::jsonb, seed.sort_order
FROM organizations o
CROSS JOIN (VALUES
  ('age_range', 'الفئة العمرية', 'range', '[]', 10),
  ('skills', 'المهارات', 'multi_select', '["problem_solving","creativity","motor_skills","memory","social","logic","stem","language","focus","coordination"]', 20),
  ('interests', 'الاهتمامات', 'multi_select', '["stem","creative","building","outdoor","role_play","board_games","cars","dolls","sports","gaming","puzzles","family"]', 30)
) AS seed(key, name, type, options, sort_order)
ON CONFLICT (org_id, key) DO NOTHING;

-- Extend the existing atomic intake with an opt-in storefront reservation.
-- Restaurant menu orders retain the current reserve-on-accept lifecycle because
-- they do not send reserve_stock=true.
CREATE OR REPLACE FUNCTION public.create_online_order_atomic(
  p_order JSONB,
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order public.online_orders%ROWTYPE;
  v_store_org UUID;
  v_warehouse_id UUID;
  v_actor_id UUID;
  v_prevent_negative BOOLEAN := true;
  v_line RECORD;
  v_stock NUMERIC;
  v_updated INT;
BEGIN
  IF current_user <> 'service_role' AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Online order items must contain between 1 and 50 lines';
  END IF;

  SELECT org_id INTO v_store_org
  FROM stores
  WHERE id = (p_order->>'store_id')::uuid AND is_active = true;
  IF v_store_org IS NULL THEN RAISE EXCEPTION 'Store not found'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS i(product_id UUID, variant_id UUID)
    LEFT JOIN products p ON p.id = i.product_id AND p.org_id = v_store_org
    LEFT JOIN product_variants pv ON pv.id = i.variant_id AND pv.product_id = i.product_id
    WHERE p.id IS NULL OR (i.variant_id IS NOT NULL AND pv.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Online order contains products outside the store organization';
  END IF;

  INSERT INTO online_orders (
    store_id, customer_name, customer_phone, notes, subtotal, total, discount,
    promo_discount, coupon_code, tax, status, fulfillment_type, delivery_area,
    delivery_address, delivery_fee
  ) VALUES (
    (p_order->>'store_id')::uuid,
    trim(p_order->>'customer_name'),
    NULLIF(trim(COALESCE(p_order->>'customer_phone', '')), ''),
    trim(COALESCE(p_order->>'notes', '')),
    COALESCE((p_order->>'subtotal')::numeric, 0),
    COALESCE((p_order->>'total')::numeric, 0),
    COALESCE((p_order->>'discount')::numeric, 0),
    COALESCE((p_order->>'promo_discount')::numeric, 0),
    NULLIF(upper(trim(COALESCE(p_order->>'coupon_code', ''))), ''),
    COALESCE((p_order->>'tax')::numeric, 0),
    'pending',
    NULLIF(p_order->>'fulfillment_type', ''),
    COALESCE(p_order->>'delivery_area', ''),
    COALESCE(p_order->>'delivery_address', ''),
    COALESCE((p_order->>'delivery_fee')::numeric, 0)
  ) RETURNING * INTO v_order;

  INSERT INTO online_order_items (
    online_order_id, product_id, variant_id, product_name, variant_name,
    quantity, unit_price, line_total, list_unit_price, discount_amount,
    promotion_rule_id
  )
  SELECT
    v_order.id, i.product_id, i.variant_id, i.product_name, i.variant_name,
    i.quantity, i.unit_price, i.line_total, i.list_unit_price,
    COALESCE(i.discount_amount, 0), i.promotion_rule_id
  FROM jsonb_to_recordset(p_items) AS i(
    product_id UUID, variant_id UUID, product_name TEXT, variant_name TEXT,
    quantity INT, unit_price NUMERIC, line_total NUMERIC,
    list_unit_price NUMERIC, discount_amount NUMERIC, promotion_rule_id UUID
  );

  IF COALESCE((p_order->>'reserve_stock')::boolean, false) THEN
    SELECT id INTO v_warehouse_id
    FROM warehouses
    WHERE store_id = v_order.store_id AND is_default = true AND is_active = true
    LIMIT 1;
    IF v_warehouse_id IS NULL THEN RAISE EXCEPTION 'Default warehouse not found'; END IF;

    SELECT id INTO v_actor_id
    FROM users
    WHERE org_id = v_store_org AND is_active = true
    ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, created_at
    LIMIT 1;
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'No active organization actor for reservation'; END IF;

    SELECT COALESCE((value->>'prevent_negative_stock')::boolean, true)
    INTO v_prevent_negative
    FROM app_settings
    WHERE org_id = v_store_org AND key = 'feature_flags'
    LIMIT 1;
    v_prevent_negative := COALESCE(v_prevent_negative, true);

    FOR v_line IN
      SELECT i.product_id, i.variant_id, SUM(i.quantity)::numeric AS quantity
      FROM online_order_items i
      JOIN products p ON p.id = i.product_id AND p.track_inventory = true
      WHERE i.online_order_id = v_order.id
      GROUP BY i.product_id, i.variant_id
      ORDER BY i.product_id, i.variant_id NULLS FIRST
    LOOP
      SELECT quantity INTO v_stock
      FROM stock_levels
      WHERE warehouse_id = v_warehouse_id
        AND product_id = v_line.product_id
        AND variant_id IS NOT DISTINCT FROM v_line.variant_id
      FOR UPDATE;
      IF v_stock IS NULL THEN RAISE EXCEPTION 'Stock level not found'; END IF;
      IF v_prevent_negative AND v_stock - v_line.quantity < 0 THEN
        RAISE EXCEPTION 'Insufficient stock';
      END IF;

      UPDATE stock_levels
      SET quantity = quantity - v_line.quantity, updated_at = now()
      WHERE warehouse_id = v_warehouse_id
        AND product_id = v_line.product_id
        AND variant_id IS NOT DISTINCT FROM v_line.variant_id;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      IF v_updated <> 1 THEN RAISE EXCEPTION 'Stock level update failed'; END IF;

      INSERT INTO inventory_movements (
        store_id, warehouse_id, product_id, variant_id, movement_type,
        quantity_delta, reference_type, reference_id, reason, created_by
      ) VALUES (
        v_order.store_id, v_warehouse_id, v_line.product_id, v_line.variant_id,
        'reservation'::movement_type, -v_line.quantity, 'online_order', v_order.id,
        'حجز طلب متجر إلكتروني', v_actor_id
      );
    END LOOP;
  END IF;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.create_online_order_atomic(JSONB, JSONB)
  FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_online_order_atomic(JSONB, JSONB)
  TO service_role;

DROP TRIGGER IF EXISTS storefront_orders_updated_at ON storefront_orders;
CREATE TRIGGER storefront_orders_updated_at
  BEFORE UPDATE ON storefront_orders
  FOR EACH ROW EXECUTE FUNCTION trg_online_orders_updated_at();

CREATE OR REPLACE FUNCTION public.create_storefront_order_atomic(
  p_order jsonb,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order storefront_orders%ROWTYPE;
  v_store_org uuid;
  v_warehouse_id uuid;
  v_actor_id uuid;
  v_prevent_negative boolean := true;
  v_customer_id uuid;
  v_line record;
  v_stock numeric;
  v_updated integer;
BEGIN
  IF current_user <> 'service_role' AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Storefront order must contain between 1 and 50 lines';
  END IF;
  SELECT org_id INTO v_store_org FROM stores
  WHERE id = (p_order->>'store_id')::uuid AND is_active = true;
  IF v_store_org IS NULL OR v_store_org <> (p_order->>'org_id')::uuid THEN
    RAISE EXCEPTION 'Storefront store organization mismatch';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS i(product_id uuid, variant_id uuid)
    LEFT JOIN products p ON p.id = i.product_id
      AND p.org_id = v_store_org AND p.is_active = true AND p.show_on_storefront = true
    LEFT JOIN product_variants pv ON pv.id = i.variant_id
      AND pv.product_id = i.product_id AND pv.is_active = true
    WHERE p.id IS NULL OR (i.variant_id IS NOT NULL AND pv.id IS NULL)
  ) THEN RAISE EXCEPTION 'Storefront order contains unavailable products'; END IF;

  -- Resolve the shared customer master inside the same transaction as the order.
  INSERT INTO customers (org_id, name, phone, email, first_order_at, last_order_at, updated_at)
  VALUES (
    v_store_org, trim(p_order->>'customer_name'), trim(p_order->>'customer_phone'),
    NULLIF(lower(trim(COALESCE(p_order->>'customer_email', ''))), ''), now(), now(), now()
  )
  ON CONFLICT (org_id, phone) DO UPDATE SET
    name = EXCLUDED.name,
    email = COALESCE(EXCLUDED.email, customers.email),
    first_order_at = COALESCE(customers.first_order_at, now()),
    last_order_at = now(),
    updated_at = now()
  RETURNING id INTO v_customer_id;

  IF NULLIF(p_order->>'auth_user_id', '') IS NOT NULL THEN
    UPDATE storefront_customer_accounts SET
      customer_id = v_customer_id,
      email = COALESCE(NULLIF(lower(trim(COALESCE(p_order->>'customer_email', ''))), ''), email),
      display_name = trim(p_order->>'customer_name'),
      updated_at = now()
    WHERE org_id = v_store_org
      AND auth_user_id = (p_order->>'auth_user_id')::uuid;
  END IF;

  IF p_order->>'fulfillment_type' = 'delivery'
     AND length(trim(COALESCE(p_order->'shipping_address'->>'address', ''))) >= 5 THEN
    UPDATE customer_addresses SET is_default = false
    WHERE customer_id = v_customer_id AND is_default = true;
    INSERT INTO customer_addresses (
      org_id, customer_id, recipient_name, phone, address_line, area, is_default, last_used_at
    ) VALUES (
      v_store_org, v_customer_id, trim(p_order->>'customer_name'), trim(p_order->>'customer_phone'),
      trim(p_order->'shipping_address'->>'address'),
      trim(COALESCE(p_order->'shipping_address'->>'area', '')), true, now()
    );
  END IF;

  INSERT INTO storefront_orders (
    org_id, store_id, customer_id, customer_name, customer_phone, customer_email,
    status, payment_method, payment_status, fulfillment_type, shipping_address,
    delivery_zone_id, delivery_area, subtotal, discount, shipping_total, tax_total,
    grand_total, currency, coupon_code, customer_notes
  ) VALUES (
    v_store_org, (p_order->>'store_id')::uuid, v_customer_id,
    trim(p_order->>'customer_name'), trim(p_order->>'customer_phone'),
    NULLIF(lower(trim(COALESCE(p_order->>'customer_email', ''))), ''),
    'pending', 'cash_on_delivery', 'pending', p_order->>'fulfillment_type',
    COALESCE(p_order->'shipping_address', '{}'::jsonb), NULLIF(p_order->>'delivery_zone_id', ''),
    COALESCE(p_order->>'delivery_area', ''), (p_order->>'subtotal')::numeric,
    COALESCE((p_order->>'discount')::numeric, 0), COALESCE((p_order->>'shipping_total')::numeric, 0),
    COALESCE((p_order->>'tax_total')::numeric, 0), (p_order->>'grand_total')::numeric,
    p_order->>'currency', NULLIF(upper(trim(COALESCE(p_order->>'coupon_code', ''))), ''),
    trim(COALESCE(p_order->>'customer_notes', ''))
  ) RETURNING * INTO v_order;

  INSERT INTO storefront_order_items (
    order_id, product_id, variant_id, sku, product_name, variant_name, image_url,
    quantity, list_unit_price, unit_price, discount_amount, line_total, attributes_snapshot
  )
  SELECT v_order.id, i.product_id, i.variant_id, COALESCE(i.sku, ''), i.product_name,
    i.variant_name, i.image_url, i.quantity, i.list_unit_price, i.unit_price,
    COALESCE(i.discount_amount, 0), i.line_total, COALESCE(i.attributes_snapshot, '{}'::jsonb)
  FROM jsonb_to_recordset(p_items) AS i(
    product_id uuid, variant_id uuid, sku text, product_name text, variant_name text,
    image_url text, quantity integer, list_unit_price numeric, unit_price numeric,
    discount_amount numeric, line_total numeric, attributes_snapshot jsonb
  );

  SELECT id INTO v_warehouse_id FROM warehouses
  WHERE store_id = v_order.store_id AND is_default = true AND is_active = true LIMIT 1;
  SELECT id INTO v_actor_id FROM users
  WHERE org_id = v_store_org AND is_active = true
  ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, created_at LIMIT 1;
  IF v_warehouse_id IS NULL OR v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Storefront inventory reservation is not configured';
  END IF;
  SELECT COALESCE((value->>'prevent_negative_stock')::boolean, true)
  INTO v_prevent_negative FROM app_settings
  WHERE org_id = v_store_org AND key = 'feature_flags' LIMIT 1;
  v_prevent_negative := COALESCE(v_prevent_negative, true);

  FOR v_line IN
    SELECT i.product_id, i.variant_id, SUM(i.quantity)::numeric quantity
    FROM storefront_order_items i JOIN products p ON p.id = i.product_id AND p.track_inventory = true
    WHERE i.order_id = v_order.id GROUP BY i.product_id, i.variant_id
    ORDER BY i.product_id, i.variant_id NULLS FIRST
  LOOP
    SELECT quantity INTO v_stock FROM stock_levels
    WHERE warehouse_id = v_warehouse_id AND product_id = v_line.product_id
      AND variant_id IS NOT DISTINCT FROM v_line.variant_id FOR UPDATE;
    IF v_stock IS NULL THEN RAISE EXCEPTION 'Stock level not found'; END IF;
    IF v_prevent_negative AND v_stock - v_line.quantity < 0 THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
    UPDATE stock_levels SET quantity = quantity - v_line.quantity, updated_at = now()
    WHERE warehouse_id = v_warehouse_id AND product_id = v_line.product_id
      AND variant_id IS NOT DISTINCT FROM v_line.variant_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN RAISE EXCEPTION 'Stock reservation failed'; END IF;
    INSERT INTO inventory_movements (
      store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
      reference_type, reference_id, reason, created_by
    ) VALUES (
      v_order.store_id, v_warehouse_id, v_line.product_id, v_line.variant_id,
      'reservation'::movement_type, -v_line.quantity, 'storefront_order', v_order.id,
      'حجز طلب متجر إلكتروني', v_actor_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'tracking_token', v_order.tracking_token, 'grand_total', v_order.grand_total,
    'currency', v_order.currency, 'status', v_order.status,
    'payment_status', v_order.payment_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order_atomic(jsonb, jsonb)
  FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_storefront_order_atomic(jsonb, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.transition_storefront_order_status_atomic(
  p_order_id uuid,
  p_status storefront_order_status,
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order storefront_orders%ROWTYPE;
  v_allowed boolean := false;
  v_line record;
  v_warehouse_id uuid;
BEGIN
  IF auth_app_user_id() IS NULL OR NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Checkout permission required';
  END IF;
  IF p_actor_id IS DISTINCT FROM auth_app_user_id()
     AND auth_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Actor mismatch';
  END IF;

  SELECT * INTO v_order FROM storefront_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL OR NOT has_store_access(v_order.store_id) THEN
    RAISE EXCEPTION 'Storefront order not found';
  END IF;
  v_allowed := v_order.status = p_status OR CASE v_order.status
    WHEN 'pending' THEN p_status IN ('confirmed', 'cancelled')
    WHEN 'confirmed' THEN p_status IN ('processing', 'cancelled')
    WHEN 'processing' THEN p_status IN ('ready_to_ship', 'cancelled')
    WHEN 'ready_to_ship' THEN p_status IN ('shipped', 'cancelled')
    WHEN 'shipped' THEN p_status IN ('delivered', 'returned')
    WHEN 'delivered' THEN p_status = 'returned'
    WHEN 'returned' THEN p_status = 'refunded'
    ELSE false
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Storefront order status transition is not allowed'; END IF;
  IF v_order.status = p_status THEN RETURN to_jsonb(v_order); END IF;

  IF p_status = 'cancelled' THEN
    SELECT id INTO v_warehouse_id FROM warehouses
    WHERE store_id = v_order.store_id AND is_default = true AND is_active = true LIMIT 1;
    FOR v_line IN
      SELECT im.product_id, im.variant_id, GREATEST(0, -SUM(im.quantity_delta)) quantity
      FROM inventory_movements im
      WHERE im.reference_type = 'storefront_order' AND im.reference_id = v_order.id
        AND im.movement_type IN ('reservation', 'reservation_release')
      GROUP BY im.product_id, im.variant_id
      HAVING GREATEST(0, -SUM(im.quantity_delta)) > 0
    LOOP
      UPDATE stock_levels SET quantity = quantity + v_line.quantity, updated_at = now()
      WHERE warehouse_id = v_warehouse_id AND product_id = v_line.product_id
        AND variant_id IS NOT DISTINCT FROM v_line.variant_id;
      INSERT INTO inventory_movements (
        store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
        reference_type, reference_id, reason, created_by
      ) VALUES (
        v_order.store_id, v_warehouse_id, v_line.product_id, v_line.variant_id,
        'reservation_release'::movement_type, v_line.quantity, 'storefront_order',
        v_order.id, 'فك حجز طلب متجر إلكتروني ملغي', p_actor_id
      );
    END LOOP;
  END IF;

  UPDATE storefront_orders SET
    status = p_status,
    confirmed_at = CASE WHEN p_status = 'confirmed' THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END,
    shipped_at = CASE WHEN p_status = 'shipped' THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
    cancelled_at = CASE WHEN p_status = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END,
    payment_status = CASE
      WHEN payment_method = 'cash_on_delivery' AND p_status = 'delivered' THEN 'paid'::storefront_payment_status
      WHEN p_status = 'cancelled' AND payment_status = 'pending' THEN 'failed'::storefront_payment_status
      ELSE payment_status
    END
  WHERE id = v_order.id RETURNING * INTO v_order;
  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_storefront_order_status_atomic(
  uuid, storefront_order_status, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_storefront_order_status_atomic(
  uuid, storefront_order_status, uuid
) TO authenticated;
