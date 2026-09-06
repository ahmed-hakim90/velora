-- Authenticated owners and managers may operate POS under their own identity.
-- Public PIN-only login remains cashier-only so a short PIN can never mint an
-- owner or manager web session.
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
  IF v_org_id IS NULL OR v_attempt_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8
     OR trim(p_pin) !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  SELECT COUNT(*) INTO v_recent_failures
  FROM pin_attempts
  WHERE org_id = v_org_id
    AND store_id = p_store_id
    AND attempted_by = v_attempt_user
    AND success = false
    AND created_at > now() - interval '10 minutes';
  IF v_recent_failures >= 5 THEN
    RAISE EXCEPTION 'Too many failed PIN attempts. Try again later.';
  END IF;

  FOR rec IN
    SELECT u.id, pc.pin_hash
    FROM users u
    JOIN pin_codes pc ON pc.user_id = u.id AND pc.is_active = true
    WHERE u.org_id = v_org_id
      AND u.role IN ('owner', 'manager', 'cashier')
      AND u.is_active = true
      AND (
        u.role IN ('owner', 'manager')
        OR EXISTS (
          SELECT 1
          FROM user_store_access usa
          WHERE usa.user_id = u.id AND usa.store_id = p_store_id
        )
      )
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
