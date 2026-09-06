-- Keep legacy unpaid online-order invoicing aligned with the secured checkout
-- entrypoint after sales mode and coupon support were added.
CREATE OR REPLACE FUNCTION public.complete_unpaid_checkout(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_discount NUMERIC,
  p_lines JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_order_id UUID;
BEGIN
  v_result := public.complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    'cash'::public.payment_method,
    p_discount,
    p_lines,
    'retail'::public.sales_mode,
    NULL::TEXT
  );
  v_order_id := (v_result->>'order_id')::UUID;

  DELETE FROM public.order_payments WHERE order_id = v_order_id;
  UPDATE public.orders SET payment_status = 'unpaid' WHERE id = v_order_id;

  PERFORM public.insert_audit_log(
    'order.created_unpaid',
    'order',
    v_order_id::TEXT,
    p_store_id,
    v_result
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_unpaid_checkout(
  UUID, UUID, UUID, UUID, NUMERIC, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_unpaid_checkout(
  UUID, UUID, UUID, UUID, NUMERIC, JSONB
) TO authenticated, service_role;
