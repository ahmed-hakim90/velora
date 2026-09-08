-- Separate till gains from shortages and preserve every original journal amount/date.
CREATE OR REPLACE FUNCTION public.ensure_system_gl_accounts(p_org_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key TEXT;
  v_code TEXT;
  v_base TEXT;
  v_parent UUID;
  v_type gl_account_type;
  v_suffix INT;
BEGIN
  IF (auth.uid() IS NULL AND session_user NOT IN ('postgres', 'supabase_admin') AND COALESCE(auth.jwt()->>'role', '') <> 'service_role')
     OR (auth.uid() IS NOT NULL AND p_org_id IS DISTINCT FROM auth_org_id()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  -- Serialize account creation for an organization, including concurrent first visits.
  PERFORM 1 FROM organizations WHERE id = p_org_id FOR UPDATE;
  FOREACH v_key IN ARRAY ARRAY['cash_over_short', 'cash_overage'] LOOP
    IF EXISTS (SELECT 1 FROM gl_accounts WHERE org_id = p_org_id AND system_key = v_key) THEN
      CONTINUE;
    END IF;
    v_type := CASE WHEN v_key = 'cash_overage' THEN 'revenue'::gl_account_type ELSE 'expense'::gl_account_type END;
    v_base := CASE WHEN v_key = 'cash_overage' THEN '4300' ELSE '5210' END;
    SELECT id INTO v_parent FROM gl_accounts
      WHERE org_id = p_org_id AND account_type = v_type AND NOT is_postable
      ORDER BY sort_order, code LIMIT 1;
    v_code := v_base;
    v_suffix := 0;
    WHILE EXISTS (SELECT 1 FROM gl_accounts WHERE org_id = p_org_id AND code = v_code) LOOP
      v_suffix := v_suffix + 1;
      v_code := v_base || '-SYS-' || v_suffix;
    END LOOP;
    INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
    VALUES (p_org_id, v_parent, v_code,
      CASE WHEN v_key = 'cash_overage' THEN 'فائض الصندوق' ELSE 'عجز الصندوق' END,
      v_type, true, true, v_key, v_base::INT);
  END LOOP;
  UPDATE gl_accounts SET name = 'عجز الصندوق'
    WHERE org_id = p_org_id AND system_key = 'cash_over_short' AND name = 'عجز وزيادة الصندوق';
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_system_gl_accounts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_system_gl_accounts(UUID) TO authenticated, service_role;

-- Ensure the new account even for callers of the existing default-CoA RPC.
-- This trigger also covers new organizations seeded outside the application.
CREATE OR REPLACE FUNCTION public.ensure_cash_overage_after_shortage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ensure_system_gl_accounts(NEW.org_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_cash_overage_after_shortage() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ensure_cash_overage_after_shortage ON public.gl_accounts;
CREATE TRIGGER ensure_cash_overage_after_shortage
AFTER INSERT ON public.gl_accounts FOR EACH ROW
WHEN (NEW.system_key = 'cash_over_short') EXECUTE FUNCTION public.ensure_cash_overage_after_shortage();

DO $$
DECLARE v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    PERFORM seed_default_chart_of_accounts(v_org.id);
    PERFORM ensure_system_gl_accounts(v_org.id);
  END LOOP;
END;
$$;

-- Append-only audit evidence identifies every moved line and its former account.
WITH moved AS (
  UPDATE journal_lines l SET account_id = new_account.id
  FROM journal_entries e, gl_accounts old_account, gl_accounts new_account
  WHERE e.id = l.entry_id AND e.org_id = l.org_id
    AND e.source = 'adjustment' AND starts_with(e.source_id, 'session_var:')
    AND l.account_id = old_account.id AND old_account.org_id = l.org_id
    AND old_account.system_key = 'cash_over_short'
    AND new_account.org_id = l.org_id AND new_account.system_key = 'cash_overage'
    AND l.credit > 0 AND l.debit = 0
  RETURNING l.id, l.org_id, l.entry_id, l.account_id, l.credit,
    old_account.id AS old_account_id, e.store_id, e.created_by, e.entry_number, e.entry_date
)
INSERT INTO audit_logs (org_id, store_id, user_id, action, entity_type, entity_id, metadata)
SELECT org_id, store_id, created_by, 'gl.cash_overage_reclassified', 'gl_journal', entry_id::TEXT,
  jsonb_build_object('migration', '20260908054302', 'line_id', id,
    'old_account_id', old_account_id, 'new_account_id', account_id,
    'credit', credit, 'entry_number', entry_number, 'entry_date', entry_date)
FROM moved;

CREATE OR REPLACE FUNCTION public.void_expense_atomic(p_expense_id UUID, p_reason TEXT DEFAULT 'سُجل بالخطأ')
RETURNS public.expenses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID := auth_org_id();
  v_actor UUID := auth_app_user_id();
  v_expense expenses;
  v_original journal_entries;
  v_reversal journal_entries;
  v_session cashier_sessions;
  v_debit NUMERIC;
  v_credit NUMERIC;
  v_count INT;
  v_seq INT;
  v_prefix TEXT;
  v_previous expense_status;
  v_reason TEXT := COALESCE(NULLIF(BTRIM(p_reason), ''), 'سُجل بالخطأ');
  v_date DATE := (now() AT TIME ZONE 'UTC')::DATE;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL OR v_actor IS NULL
     OR NOT EXISTS (SELECT 1 FROM users WHERE id = v_actor AND org_id = v_org AND is_active) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT has_permission('expense_delete') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  PERFORM require_feature('session_expenses');
  SELECT e.* INTO v_expense FROM expenses e JOIN stores s ON s.id = e.store_id
    WHERE e.id = p_expense_id AND s.org_id = v_org FOR UPDATE OF e;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT has_store_access(v_expense.store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF v_expense.status = 'voided' THEN RETURN v_expense; END IF;
  IF v_expense.inventory_item_id IS NOT NULL THEN RAISE EXCEPTION 'Cannot delete inventory purchase expenses'; END IF;
  IF v_expense.session_id IS NOT NULL THEN
    SELECT * INTO v_session FROM cashier_sessions WHERE id = v_expense.session_id FOR UPDATE;
    IF v_session.status = 'closed' THEN RAISE EXCEPTION 'Cannot modify expenses for a closed session'; END IF;
  END IF;
  IF is_period_closed(v_expense.store_id, now()) THEN RAISE EXCEPTION 'الفترة مقفولة'; END IF;
  v_previous := v_expense.status;
  -- Reverse an existing financial effect even when GL was subsequently disabled.
  SELECT * INTO v_original FROM journal_entries
    WHERE org_id = v_org AND source = 'expense' AND source_id = p_expense_id::TEXT AND status = 'posted'
    FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_reversal FROM journal_entries
      WHERE org_id = v_org AND source = 'adjustment' AND source_id = 'expense-void:' || p_expense_id AND status = 'posted';
    IF NOT FOUND THEN
      PERFORM 1 FROM journal_lines WHERE entry_id = v_original.id FOR UPDATE;
      SELECT count(*), COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
        INTO v_count, v_debit, v_credit FROM journal_lines WHERE entry_id = v_original.id AND org_id = v_org;
      IF v_count < 2 OR v_debit <= 0 OR v_debit <> v_credit THEN RAISE EXCEPTION 'القيد الأصلي غير متوازن'; END IF;
      IF EXISTS (SELECT 1 FROM journal_lines l JOIN gl_accounts a ON a.id = l.account_id
        WHERE l.entry_id = v_original.id AND (a.org_id <> v_org OR NOT a.is_active OR NOT a.is_postable)) THEN
        RAISE EXCEPTION 'حساب القيد غير صالح للعكس';
      END IF;
      v_prefix := 'JE-' || to_char(v_date, 'YYYYMMDD') || '-';
      SELECT count(*) + 1 INTO v_seq FROM journal_entries WHERE org_id = v_org AND starts_with(entry_number, v_prefix);
      LOOP
        INSERT INTO journal_entries (org_id, store_id, entry_number, entry_date, status, source, source_id, memo, created_by, posted_by, posted_at)
        VALUES (v_org, v_expense.store_id, v_prefix || lpad(v_seq::TEXT, GREATEST(4, length(v_seq::TEXT)), '0'),
          v_date, 'posted', 'adjustment', 'expense-void:' || p_expense_id,
          'عكس مصروف ملغي: ' || v_expense.title, v_actor, v_actor, now())
        ON CONFLICT (org_id, entry_number) DO NOTHING RETURNING * INTO v_reversal;
        EXIT WHEN FOUND;
        v_seq := v_seq + 1;
      END LOOP;
      INSERT INTO journal_lines (org_id, entry_id, account_id, debit, credit, memo, line_no)
      SELECT v_org, v_reversal.id, account_id, credit, debit, memo, line_no
        FROM journal_lines WHERE entry_id = v_original.id AND org_id = v_org;
    END IF;
  END IF;
  PERFORM treasury_reverse_expense(p_expense_id);
  UPDATE expenses SET status = 'voided', voided_by = v_actor, voided_at = now(), void_reason = v_reason
    WHERE id = p_expense_id RETURNING * INTO v_expense;
  PERFORM insert_audit_log('expense.voided', 'expense', p_expense_id::TEXT, v_expense.store_id,
    jsonb_build_object('amount', v_expense.amount, 'previous_status', v_previous, 'reason', v_reason,
      'gl_reversal_source_id', 'expense-void:' || p_expense_id, 'reversal_entry_id', v_reversal.id));
  RETURN v_expense;
END;
$$;
REVOKE ALL ON FUNCTION public.void_expense_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_expense_atomic(UUID, TEXT) TO authenticated;

-- Filter recovery before pagination; a resolved page must not hide older open errors.
CREATE OR REPLACE FUNCTION public.list_unresolved_gl_failures(p_since TIMESTAMPTZ, p_limit INT DEFAULT 8)
RETURNS SETOF public.audit_logs LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT f.* FROM audit_logs f
  WHERE f.org_id = auth_org_id() AND f.action = 'gl.posting_failed' AND f.created_at >= p_since
    AND NOT EXISTS (
      SELECT 1 FROM audit_logs r WHERE r.org_id = f.org_id AND r.action = 'gl.posting_recovered'
        AND r.metadata->>'failure_id' = f.id::TEXT
    )
  ORDER BY f.created_at DESC, f.id DESC LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;
REVOKE ALL ON FUNCTION public.list_unresolved_gl_failures(TIMESTAMPTZ, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unresolved_gl_failures(TIMESTAMPTZ, INT) TO authenticated;
CREATE INDEX IF NOT EXISTS audit_logs_gl_recovery_failure_idx ON public.audit_logs (org_id, (metadata->>'failure_id'))
  WHERE action = 'gl.posting_recovered';
