ALTER TABLE public.cashier_sessions
  ADD CONSTRAINT cashier_sessions_opening_cash_nonnegative
    CHECK (opening_cash >= 0),
  ADD CONSTRAINT cashier_sessions_actual_cash_nonnegative
    CHECK (actual_cash IS NULL OR actual_cash >= 0);
