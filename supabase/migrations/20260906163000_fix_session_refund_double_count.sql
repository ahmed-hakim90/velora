-- A voided/refunded order retains its original positive order_payments rows.
-- Reconciliation must therefore count the original cash receipt and the cash
-- reversal. The previous formula excluded the receipt and still subtracted the
-- reversal, understating expected cash by the cancelled order's cash payment.

CREATE OR REPLACE FUNCTION public.pos_session_cash_bundle(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH selected_session AS (
    SELECT id, opening_cash
    FROM public.cashier_sessions
    WHERE id = p_session_id
  ),
  order_summary AS (
    SELECT
      COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0) AS total_sales,
      COUNT(*) FILTER (WHERE o.status = 'completed') AS order_count
    FROM public.orders o
    WHERE o.session_id = p_session_id
  ),
  payment_summary AS (
    SELECT
      COALESCE(SUM(op.amount) FILTER (
        WHERE o.status IN ('completed', 'voided', 'refunded')
          AND op.method = 'cash'
      ), 0) AS cash_sales,
      COALESCE(SUM(op.amount) FILTER (
        WHERE o.status IN ('voided', 'refunded') AND op.method = 'cash'
      ), 0) AS cash_refunds
    FROM public.orders o
    JOIN public.order_payments op ON op.order_id = o.id
    WHERE o.session_id = p_session_id
  ),
  expense_summary AS (
    SELECT
      COALESCE(SUM(e.amount) FILTER (
        WHERE e.expense_source = 'session_cash'
          AND e.payment_method = 'cash'
          AND e.status = 'approved'
      ), 0) AS cash_expenses,
      COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb) AS rows
    FROM public.expenses e
    WHERE e.session_id = p_session_id
  ),
  supplier_summary AS (
    SELECT
      COALESCE(SUM(sp.amount) FILTER (
        WHERE sp.voided_at IS NULL AND sp.payment_method = 'cash'
      ), 0) AS cash_supplier_payments,
      COALESCE(jsonb_agg(to_jsonb(sp) ORDER BY sp.paid_at DESC), '[]'::jsonb) AS rows
    FROM public.supplier_payments sp
    WHERE sp.session_id = p_session_id
  )
  SELECT jsonb_build_object(
    'reconciliation', jsonb_build_object(
      'openingCash', s.opening_cash,
      'cashSales', p.cash_sales,
      'cashRefunds', p.cash_refunds,
      'expenses', e.cash_expenses,
      'supplierPayments', sp.cash_supplier_payments,
      'expectedCash', s.opening_cash + p.cash_sales - p.cash_refunds - e.cash_expenses - sp.cash_supplier_payments,
      'totalSales', o.total_sales,
      'orderCount', o.order_count
    ),
    'expenses', e.rows,
    'supplierPayments', sp.rows
  )
  FROM selected_session s
  CROSS JOIN order_summary o
  CROSS JOIN payment_summary p
  CROSS JOIN expense_summary e
  CROSS JOIN supplier_summary sp;
$$;

REVOKE ALL ON FUNCTION public.pos_session_cash_bundle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_session_cash_bundle(uuid) TO authenticated, service_role;

-- Keep the reporting RPC aligned with the close-session source of truth.
CREATE OR REPLACE FUNCTION public.report_session_reconciliation(p_session_id UUID)
RETURNS TABLE (
  opening_cash NUMERIC,
  cash_sales NUMERIC,
  card_sales NUMERIC,
  wallet_sales NUMERIC,
  credit_sales NUMERIC,
  cash_refunds NUMERIC,
  expenses NUMERIC,
  customer_payments NUMERIC,
  expected_cash NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session cashier_sessions%ROWTYPE;
  v_cash_sales NUMERIC := 0;
  v_card_sales NUMERIC := 0;
  v_wallet_sales NUMERIC := 0;
  v_credit_sales NUMERIC := 0;
  v_cash_refunds NUMERIC := 0;
  v_expenses NUMERIC := 0;
BEGIN
  SELECT * INTO v_session FROM cashier_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(CASE
      WHEN op.method = 'cash' THEN op.amount ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN o.status = 'completed' AND op.method = 'card' THEN op.amount ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN o.status = 'completed' AND op.method = 'wallet' THEN op.amount ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN o.status = 'completed' AND op.method = 'credit' THEN op.amount ELSE 0
    END), 0)
  INTO v_cash_sales, v_card_sales, v_wallet_sales, v_credit_sales
  FROM orders o
  JOIN order_payments op ON op.order_id = o.id
  WHERE o.session_id = p_session_id
    AND o.status IN ('completed', 'voided', 'refunded');

  SELECT COALESCE(SUM(op.amount), 0) INTO v_cash_refunds
  FROM orders o
  JOIN order_payments op ON op.order_id = o.id
  WHERE o.session_id = p_session_id
    AND o.status IN ('voided', 'refunded')
    AND op.method = 'cash';

  SELECT COALESCE(SUM(e.amount), 0) INTO v_expenses
  FROM expenses e
  WHERE e.session_id = p_session_id
    AND e.expense_source = 'session_cash'
    AND e.payment_method = 'cash'
    AND e.status = 'approved';

  RETURN QUERY SELECT
    v_session.opening_cash,
    v_cash_sales,
    v_card_sales,
    v_wallet_sales,
    v_credit_sales,
    v_cash_refunds,
    v_expenses,
    0::NUMERIC,
    (v_session.opening_cash + v_cash_sales - v_cash_refunds - v_expenses)::NUMERIC;
END;
$$;

-- Repair only closed sessions whose stored expected value exactly matches the
-- buggy formula against their current rows. This deliberately skips sessions
-- changed by a refund after close or manually corrected data.
CREATE TEMP TABLE _session_reconciliation_repairs ON COMMIT DROP AS
WITH order_cash AS (
  SELECT
    o.session_id,
    COALESCE(SUM(op.amount) FILTER (
      WHERE o.status = 'completed' AND op.method = 'cash'
    ), 0) AS legacy_cash_sales,
    COALESCE(SUM(op.amount) FILTER (
      WHERE o.status IN ('completed', 'voided', 'refunded') AND op.method = 'cash'
    ), 0) AS corrected_cash_sales,
    COALESCE(SUM(op.amount) FILTER (
      WHERE o.status IN ('voided', 'refunded') AND op.method = 'cash'
    ), 0) AS cash_refunds
  FROM orders o
  LEFT JOIN order_payments op ON op.order_id = o.id
  WHERE o.session_id IS NOT NULL
  GROUP BY o.session_id
), expense_cash AS (
  SELECT session_id, COALESCE(SUM(amount), 0) AS amount
  FROM expenses
  WHERE session_id IS NOT NULL
    AND expense_source = 'session_cash'
    AND payment_method = 'cash'
    AND status = 'approved'
  GROUP BY session_id
), supplier_cash AS (
  SELECT session_id, COALESCE(SUM(amount), 0) AS amount
  FROM supplier_payments
  WHERE session_id IS NOT NULL
    AND voided_at IS NULL
    AND payment_method = 'cash'
  GROUP BY session_id
), candidates AS (
  SELECT
    cs.id AS session_id,
    st.org_id,
    cs.store_id,
    COALESCE(cs.closed_by, cs.cashier_id) AS actor_id,
    COALESCE(cs.closed_at::date, cs.opened_at::date) AS entry_date,
    cs.expected_cash AS old_expected_cash,
    cs.variance AS old_variance,
    ROUND(
      cs.opening_cash
      + COALESCE(oc.legacy_cash_sales, 0)
      - COALESCE(oc.cash_refunds, 0)
      - COALESCE(ec.amount, 0)
      - COALESCE(sc.amount, 0),
      2
    ) AS legacy_expected_cash,
    ROUND(
      cs.opening_cash
      + COALESCE(oc.corrected_cash_sales, 0)
      - COALESCE(oc.cash_refunds, 0)
      - COALESCE(ec.amount, 0)
      - COALESCE(sc.amount, 0),
      2
    ) AS corrected_expected_cash
  FROM cashier_sessions cs
  JOIN stores st ON st.id = cs.store_id
  LEFT JOIN order_cash oc ON oc.session_id = cs.id
  LEFT JOIN expense_cash ec ON ec.session_id = cs.id
  LEFT JOIN supplier_cash sc ON sc.session_id = cs.id
  WHERE cs.status = 'closed'
    AND cs.expected_cash IS NOT NULL
    AND cs.actual_cash IS NOT NULL
)
SELECT
  c.*,
  ROUND(cs.actual_cash - c.corrected_expected_cash, 2) AS corrected_variance,
  je.id AS old_journal_id,
  je.entry_date AS journal_entry_date,
  je.created_by AS journal_created_by
FROM candidates c
JOIN cashier_sessions cs ON cs.id = c.session_id
LEFT JOIN journal_entries je
  ON je.org_id = c.org_id
 AND je.source = 'adjustment'
 AND je.source_id = 'session_var:' || c.session_id::text
 AND je.status = 'posted'
WHERE ROUND(c.old_expected_cash, 2) = c.legacy_expected_cash
  AND c.corrected_expected_cash <> c.legacy_expected_cash;

UPDATE cashier_sessions cs
SET
  expected_cash = r.corrected_expected_cash,
  variance = r.corrected_variance
FROM _session_reconciliation_repairs r
WHERE cs.id = r.session_id;

UPDATE journal_entries je
SET
  status = 'void',
  voided_by = r.actor_id,
  voided_at = now()
FROM _session_reconciliation_repairs r
WHERE je.id = r.old_journal_id;

CREATE TEMP TABLE _session_variance_replacement_journals ON COMMIT DROP AS
SELECT
  gen_random_uuid() AS journal_id,
  r.*
FROM _session_reconciliation_repairs r
WHERE r.old_journal_id IS NOT NULL
  AND r.corrected_variance <> 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _session_variance_replacement_journals r
    WHERE (
      SELECT COUNT(*)
      FROM gl_accounts a
      WHERE a.org_id = r.org_id
        AND a.system_key IN ('cash', 'cash_over_short')
    ) <> 2
  ) THEN
    RAISE EXCEPTION 'Cannot repair session variance journal: required system accounts are missing';
  END IF;
END;
$$;

INSERT INTO journal_entries (
  id, org_id, store_id, entry_number, entry_date, status, source, source_id,
  memo, posted_by, posted_at, created_by
)
SELECT
  journal_id,
  org_id,
  store_id,
  'JE-REPAIR-' || session_id::text,
  COALESCE(journal_entry_date, entry_date),
  'posted',
  'adjustment',
  'session_var:' || session_id::text,
  'تصحيح فرق إقفال وردية بعد إصلاح احتساب الإلغاء والمرتجع',
  COALESCE(journal_created_by, actor_id),
  now(),
  COALESCE(journal_created_by, actor_id)
FROM _session_variance_replacement_journals;

INSERT INTO journal_lines (
  org_id, entry_id, account_id, debit, credit, memo, line_no
)
SELECT
  r.org_id,
  r.journal_id,
  a.id,
  CASE
    WHEN a.system_key = 'cash' AND r.corrected_variance > 0 THEN r.corrected_variance
    WHEN a.system_key = 'cash_over_short' AND r.corrected_variance < 0 THEN -r.corrected_variance
    ELSE 0
  END,
  CASE
    WHEN a.system_key = 'cash' AND r.corrected_variance < 0 THEN -r.corrected_variance
    WHEN a.system_key = 'cash_over_short' AND r.corrected_variance > 0 THEN r.corrected_variance
    ELSE 0
  END,
  'تصحيح فرق إقفال وردية',
  CASE WHEN a.system_key = 'cash' THEN 1 ELSE 2 END
FROM _session_variance_replacement_journals r
JOIN gl_accounts a
  ON a.org_id = r.org_id
 AND a.system_key IN ('cash', 'cash_over_short');

INSERT INTO audit_logs (
  org_id, store_id, user_id, action, entity_type, entity_id, metadata
)
SELECT
  org_id,
  store_id,
  actor_id,
  'session.reconciliation_repaired',
  'cashier_session',
  session_id::text,
  jsonb_build_object(
    'old_expected_cash', old_expected_cash,
    'corrected_expected_cash', corrected_expected_cash,
    'old_variance', old_variance,
    'corrected_variance', corrected_variance,
    'old_variance_journal_id', old_journal_id
  )
FROM _session_reconciliation_repairs;
