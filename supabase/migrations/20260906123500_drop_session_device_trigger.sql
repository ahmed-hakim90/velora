-- Device registration was removed from POS sessions, but the legacy trigger
-- still rejected every new session whose device_id is NULL.
DROP TRIGGER IF EXISTS trg_session_device_store ON public.cashier_sessions;
DROP FUNCTION IF EXISTS public.check_session_device_store();
