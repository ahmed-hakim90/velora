DO $$
DECLARE
  forbidden_table text;
  forbidden_function text;
  pin_source text;
BEGIN
  FOREACH forbidden_table IN ARRAY ARRAY[
    'devices',
    'device_pairing_codes',
    'device_pairing_attempts',
    'user_device_access'
  ]
  LOOP
    IF to_regclass('public.' || forbidden_table) IS NOT NULL THEN
      RAISE EXCEPTION 'Forbidden device table still exists: %', forbidden_table;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('cashier_sessions', 'pos_held_carts')
      AND column_name = 'device_id'
  ) THEN
    RAISE EXCEPTION 'Forbidden device_id column still exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND (t.tgname ILIKE '%device%' OR pg_get_triggerdef(t.oid) ILIKE '%device_id%')
  ) THEN
    RAISE EXCEPTION 'Forbidden device trigger still exists';
  END IF;

  SELECT p.oid::regprocedure::text
  INTO forbidden_function
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND (
      p.proname IN (
        'assert_device_pairing_rate_limit',
        'cashier_can_use_device',
        'check_pos_held_cart_device_store',
        'check_session_device_store',
        'consume_device_pairing_code',
        'create_device_pairing_code',
        'record_device_pairing_attempt',
        'touch_device_seen'
      )
      OR pg_get_function_arguments(p.oid) ILIKE '%p_device_id%'
      OR p.prosrc ~* '(device_pairing|user_device_access|from[[:space:]]+devices|join[[:space:]]+devices|into[[:space:]]+devices)'
    )
  LIMIT 1;

  IF forbidden_function IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden device function still exists: %', forbidden_function;
  END IF;

  SELECT p.prosrc
  INTO pin_source
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'set_user_pin'
    AND p.prokind = 'f'
  ORDER BY p.oid DESC
  LIMIT 1;

  IF pin_source IS NULL
    OR pin_source NOT ILIKE '%owner%'
    OR pin_source NOT ILIKE '%manager%'
    OR pin_source NOT ILIKE '%cashier%'
  THEN
    RAISE EXCEPTION 'set_user_pin roles do not match the UI PIN roles';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.app_settings
    WHERE key = 'platform_plan' AND value ? 'max_devices'
  ) THEN
    RAISE EXCEPTION 'Legacy max_devices plan setting still exists';
  END IF;
END $$;
