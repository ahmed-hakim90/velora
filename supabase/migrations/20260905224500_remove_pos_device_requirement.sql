-- POS access is store + cashier scoped. Device registration is no longer part of
-- login, session ownership, manager approval, or held-cart ownership.

ALTER TABLE public.cashier_sessions
  ALTER COLUMN device_id DROP NOT NULL;

DROP TRIGGER IF EXISTS trg_pos_held_cart_device_store ON public.pos_held_carts;
ALTER TABLE public.pos_held_carts
  ALTER COLUMN device_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.verify_cashier_pin(
  p_store_id UUID,
  p_pin TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
  v_org_id UUID;
  v_attempt_user UUID;
  v_recent_failures INT;
BEGIN
  v_org_id := auth_org_id();
  v_attempt_user := auth_app_user_id();
  IF v_org_id IS NULL OR v_attempt_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT has_store_access(p_store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8 OR trim(p_pin) !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  SELECT COUNT(*) INTO v_recent_failures
  FROM pin_attempts
  WHERE org_id = v_org_id AND store_id = p_store_id
    AND attempted_by = v_attempt_user AND success = false
    AND created_at > now() - interval '10 minutes';
  IF v_recent_failures >= 5 THEN RAISE EXCEPTION 'Too many failed PIN attempts. Try again later.'; END IF;

  FOR rec IN
    SELECT u.id, pc.pin_hash
    FROM users u
    JOIN pin_codes pc ON pc.user_id = u.id AND pc.is_active = true
    JOIN user_store_access usa ON usa.user_id = u.id AND usa.store_id = p_store_id
    WHERE u.org_id = v_org_id AND u.role = 'cashier' AND u.is_active = true
  LOOP
    IF rec.pin_hash = extensions.crypt(trim(p_pin), rec.pin_hash) THEN
      INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
      VALUES (v_org_id, p_store_id, rec.id, true);
      RETURN rec.id;
    END IF;
  END LOOP;
  INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
  VALUES (v_org_id, p_store_id, v_attempt_user, false);
  RAISE EXCEPTION 'Invalid PIN';
END;
$$;

REVOKE ALL ON FUNCTION public.verify_cashier_pin(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_cashier_pin(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.login_cashier_by_pin(
  p_org_id UUID,
  p_store_id UUID,
  p_pin TEXT
)
RETURNS TABLE (user_id UUID, auth_user_id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
  v_recent_failures INT;
  v_org_status TEXT;
BEGIN
  IF p_org_id IS NULL OR p_store_id IS NULL THEN RAISE EXCEPTION 'Invalid PIN login context'; END IF;
  IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8 OR trim(p_pin) !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;
  SELECT o.status INTO v_org_status FROM organizations o WHERE o.id = p_org_id;
  IF v_org_status IS NULL THEN RAISE EXCEPTION 'Organization not found'; END IF;
  IF v_org_status = 'suspended' THEN RAISE EXCEPTION 'Organization suspended'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.id = p_store_id AND s.org_id = p_org_id AND s.is_active = true
  ) THEN RAISE EXCEPTION 'Store access denied'; END IF;

  SELECT COUNT(*) INTO v_recent_failures
  FROM pin_attempts
  WHERE org_id = p_org_id AND store_id = p_store_id AND success = false
    AND created_at > now() - interval '10 minutes';
  IF v_recent_failures >= 20 THEN RAISE EXCEPTION 'Too many failed PIN attempts. Try again later.'; END IF;

  FOR rec IN
    SELECT u.id, u.auth_user_id, u.email, pc.pin_hash
    FROM users u
    JOIN pin_codes pc ON pc.user_id = u.id AND pc.is_active = true
    JOIN user_store_access usa ON usa.user_id = u.id AND usa.store_id = p_store_id
    WHERE u.org_id = p_org_id AND u.role = 'cashier' AND u.is_active = true
      AND u.auth_user_id IS NOT NULL
  LOOP
    IF rec.pin_hash = extensions.crypt(trim(p_pin), rec.pin_hash) THEN
      INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
      VALUES (p_org_id, p_store_id, rec.id, true);
      user_id := rec.id; auth_user_id := rec.auth_user_id; email := rec.email;
      RETURN NEXT; RETURN;
    END IF;
  END LOOP;
  INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
  VALUES (p_org_id, p_store_id, NULL, false);
  RAISE EXCEPTION 'Invalid PIN';
END;
$$;

REVOKE ALL ON FUNCTION public.login_cashier_by_pin(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_cashier_by_pin(UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_manager_override_pin(
  p_store_id UUID,
  p_pin TEXT,
  p_device_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.verify_manager_override_pin(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_manager_override_pin(UUID, TEXT, UUID) TO authenticated;
