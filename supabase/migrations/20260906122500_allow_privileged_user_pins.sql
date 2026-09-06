-- Owners/managers use a PIN for POS approvals, while cashiers use one to
-- unlock their own POS identity. Keep the database contract aligned with the
-- user-management UI and verify_manager_override_pin.
CREATE OR REPLACE FUNCTION public.set_user_pin(p_user_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8
     OR trim(p_pin) !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 8 digits';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_user_id
      AND org_id = auth_org_id()
      AND role IN ('owner', 'manager', 'cashier')
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'PIN user not found';
  END IF;

  UPDATE public.pin_codes
  SET is_active = false
  WHERE user_id = p_user_id;

  INSERT INTO public.pin_codes (user_id, pin_hash, is_active)
  VALUES (p_user_id, extensions.crypt(trim(p_pin), extensions.gen_salt('bf')), true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_pin(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_pin(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_user_pin(UUID, TEXT) IS
  'Set an owner, manager, or cashier PIN within the current organization.';
