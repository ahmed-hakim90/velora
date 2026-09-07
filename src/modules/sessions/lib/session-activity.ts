import type { Expense, Order, OrderPayment, SupplierPayment } from "@/lib/types";

export type SessionActivityTone = "neutral" | "positive" | "negative" | "warning";

export interface SessionActivityEvent {
  id: string;
  kind:
    | "session_opened"
    | "session_closed"
    | "sale"
    | "sale_voided"
    | "sale_refunded"
    | "expense"
    | "expense_voided"
    | "supplier_payment"
    | "supplier_payment_voided";
  occurredAt: string;
  title: string;
  description: string;
  amount: number | null;
  discount: number;
  actorName: string | null;
  tone: SessionActivityTone;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  wallet: "محفظة",
  credit: "آجل",
  other: "أخرى",
};

function paymentSummary(payments: OrderPayment[]): string {
  if (payments.length === 0) return "طريقة الدفع غير مسجلة";
  return payments
    .map(
      (payment) =>
        `${PAYMENT_LABELS[payment.method] ?? payment.method}: ${payment.amount.toFixed(2)}`
    )
    .join(" · ");
}

export function buildSessionActivity(input: {
  session: {
    id: string;
    opened_at: string;
    closed_at: string | null;
    opening_cash: number;
    actual_cash: number | null;
    cashier_id: string;
    closed_by: string | null;
  };
  orders: Order[];
  orderPayments: OrderPayment[];
  expenses: Expense[];
  supplierPayments: SupplierPayment[];
  userNames: Map<string, string>;
  supplierNames: Map<string, string>;
}): SessionActivityEvent[] {
  const paymentsByOrder = new Map<string, OrderPayment[]>();
  for (const payment of input.orderPayments) {
    const rows = paymentsByOrder.get(payment.order_id) ?? [];
    rows.push(payment);
    paymentsByOrder.set(payment.order_id, rows);
  }

  const events: SessionActivityEvent[] = [
    {
      id: `session-open:${input.session.id}`,
      kind: "session_opened",
      occurredAt: input.session.opened_at,
      title: "فتح الجلسة",
      description: `رصيد بداية الدرج ${input.session.opening_cash}`,
      amount: input.session.opening_cash,
      discount: 0,
      actorName: input.userNames.get(input.session.cashier_id) ?? null,
      tone: "neutral",
    },
  ];

  for (const order of input.orders) {
    const promoDiscount = Math.min(order.discount, Math.max(0, order.promo_discount ?? 0));
    const manualDiscount = Math.max(0, order.discount - promoDiscount);
    const discountParts = [
      manualDiscount > 0 ? `خصم يدوي ${manualDiscount}` : "",
      promoDiscount > 0 ? `عرض تلقائي ${promoDiscount}` : "",
    ].filter(Boolean);
    const state =
      order.status === "voided"
        ? "فاتورة ملغاة"
        : order.status === "refunded"
          ? "فاتورة مستردة"
          : "فاتورة بيع";
    events.push({
      id: `order:${order.id}`,
      kind:
        order.status === "voided"
          ? "sale_voided"
          : order.status === "refunded"
            ? "sale_refunded"
            : "sale",
      occurredAt: order.created_at,
      title: `${state} ${order.order_number}`,
      description: [
        paymentSummary(paymentsByOrder.get(order.id) ?? []),
        ...discountParts,
      ].join(" · "),
      amount: order.total,
      discount: order.discount,
      actorName: input.userNames.get(order.created_by) ?? null,
      tone:
        order.status === "voided" || order.status === "refunded"
          ? "negative"
          : order.discount > 0
            ? "warning"
            : "positive",
    });
  }

  for (const expense of input.expenses) {
    const voided = expense.status === "voided";
    events.push({
      id: `expense:${expense.id}`,
      kind: voided ? "expense_voided" : "expense",
      occurredAt: expense.created_at,
      title: voided ? `مصروف ملغي: ${expense.title}` : `مصروف: ${expense.title}`,
      description: [
        PAYMENT_LABELS[expense.payment_method] ?? expense.payment_method,
        expense.notes,
        voided && expense.void_reason ? `سبب الإلغاء: ${expense.void_reason}` : "",
      ].filter(Boolean).join(" · "),
      amount: expense.amount,
      discount: 0,
      actorName: input.userNames.get(expense.created_by) ?? null,
      tone: voided ? "neutral" : "negative",
    });
  }

  for (const payment of input.supplierPayments) {
    const voided = Boolean(payment.voided_at);
    const supplierName = input.supplierNames.get(payment.supplier_id) ?? "مورد";
    events.push({
      id: `supplier-payment:${payment.id}`,
      kind: voided ? "supplier_payment_voided" : "supplier_payment",
      occurredAt: payment.paid_at,
      title: voided ? `دفعة مورد ملغاة: ${supplierName}` : `دفعة مورد: ${supplierName}`,
      description: [
        PAYMENT_LABELS[payment.payment_method] ?? payment.payment_method,
        payment.reference ? `مرجع ${payment.reference}` : "",
        payment.notes,
      ].filter(Boolean).join(" · "),
      amount: payment.amount,
      discount: 0,
      actorName: input.userNames.get(payment.created_by) ?? null,
      tone: voided ? "neutral" : "negative",
    });
  }

  if (input.session.closed_at) {
    events.push({
      id: `session-close:${input.session.id}`,
      kind: "session_closed",
      occurredAt: input.session.closed_at,
      title: "إغلاق الجلسة",
      description: "تم تسجيل الرصيد الفعلي للدرج",
      amount: input.session.actual_cash,
      discount: 0,
      actorName: input.session.closed_by
        ? (input.userNames.get(input.session.closed_by) ?? null)
        : null,
      tone: "neutral",
    });
  }

  return events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}
