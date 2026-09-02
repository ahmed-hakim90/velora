CREATE INDEX IF NOT EXISTS idx_orders_session_status
  ON public.orders(session_id, status)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id
  ON public.order_payments(order_id);

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
        WHERE o.status = 'completed' AND op.method = 'cash'
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
