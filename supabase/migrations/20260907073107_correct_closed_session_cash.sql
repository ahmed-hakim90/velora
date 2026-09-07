CREATE OR REPLACE FUNCTION correct_closed_session_cash(
  p_session_id UUID,
  p_actual_cash NUMERIC,
  p_reason TEXT
) RETURNS cashier_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_session cashier_sessions;
  v_vault cashier_vaults;
  v_old_actual NUMERIC;
  v_new_actual NUMERIC;
  v_delta NUMERIC;
  v_reason TEXT;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  v_new_actual := ROUND(p_actual_cash, 2);
  v_reason := BTRIM(COALESCE(p_reason, ''));

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'تصحيح إقفال الوردية متاح للمالك والمدير فقط';
  END IF;
  IF p_actual_cash IS NULL OR p_actual_cash < 0 THEN
    RAISE EXCEPTION 'المبلغ الفعلي لازم يكون صفر أو أكبر';
  END IF;
  IF v_reason = '' THEN
    RAISE EXCEPTION 'سبب التصحيح مطلوب';
  END IF;

  SELECT cs.* INTO v_session
  FROM cashier_sessions cs
  JOIN stores s ON s.id = cs.store_id
  WHERE cs.id = p_session_id
    AND s.org_id = v_org_id
  FOR UPDATE OF cs;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الجلسة غير موجودة';
  END IF;
  IF NOT has_store_access(v_session.store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF is_period_closed(v_session.store_id, COALESCE(v_session.closed_at, v_session.opened_at)) THEN
    RAISE EXCEPTION 'الفترة المحاسبية الخاصة بالوردية مقفولة';
  END IF;
  IF v_session.status <> 'closed' OR v_session.actual_cash IS NULL OR v_session.expected_cash IS NULL THEN
    RAISE EXCEPTION 'يمكن تصحيح جلسة مقفولة فقط';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM cashier_vault_ledger
    WHERE session_id = p_session_id AND entry_type = 'session_close_deposit'
  ) THEN
    RAISE EXCEPTION 'إيداع إقفال الوردية لم يكتمل؛ راجع الخزينة قبل التصحيح';
  END IF;

  v_old_actual := v_session.actual_cash;
  v_delta := v_new_actual - v_old_actual;

  SELECT * INTO v_vault
  FROM cashier_vaults
  WHERE org_id = v_org_id
    AND store_id = v_session.store_id
    AND cashier_id = v_session.cashier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'خزينة الكاشير غير موجودة';
  END IF;
  IF v_vault.balance + v_delta < 0 THEN
    RAISE EXCEPTION 'رصيد خزينة الكاشير لا يكفي لتنفيذ التصحيح';
  END IF;

  UPDATE cashier_vaults
  SET balance = balance + v_delta, updated_at = now()
  WHERE id = v_vault.id
  RETURNING * INTO v_vault;

  UPDATE cashier_sessions
  SET actual_cash = v_new_actual,
      variance = ROUND(v_new_actual - expected_cash, 2)
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  IF v_delta <> 0 THEN
    INSERT INTO cashier_vault_ledger (
      org_id, store_id, cashier_id, vault_id, entry_type,
      amount, balance_after, session_id, notes, created_by
    ) VALUES (
      v_org_id, v_session.store_id, v_session.cashier_id, v_vault.id,
      'session_close_deposit', v_delta, v_vault.balance, p_session_id,
      'تصحيح عدّ الدرج: ' || v_reason, v_user_id
    );
  END IF;

  PERFORM insert_audit_log(
    'session.closing_cash_corrected',
    'cashier_session',
    p_session_id::text,
    v_session.store_id,
    jsonb_build_object(
      'old_actual_cash', v_old_actual,
      'new_actual_cash', v_new_actual,
      'old_variance', ROUND(v_old_actual - v_session.expected_cash, 2),
      'new_variance', v_session.variance,
      'vault_adjustment', v_delta,
      'vault_balance_after', v_vault.balance,
      'reason', v_reason
    )
  );

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION correct_closed_session_cash(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION correct_closed_session_cash(UUID, NUMERIC, TEXT) TO authenticated;
