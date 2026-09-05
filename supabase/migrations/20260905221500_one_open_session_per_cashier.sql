-- A cashier owns an independent shift. Prevent duplicate open shifts caused by
-- double taps or the same cashier opening concurrently from multiple devices.
CREATE UNIQUE INDEX IF NOT EXISTS cashier_sessions_one_open_per_cashier_store_idx
  ON public.cashier_sessions (store_id, cashier_id)
  WHERE status = 'open';
