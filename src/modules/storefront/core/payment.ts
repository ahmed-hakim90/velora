export type StorefrontPaymentMethod = "cash_on_delivery";

export type PaymentIntentInput = {
  method: StorefrontPaymentMethod;
  amount: number;
  currency: string;
  orderReference: string;
};

export type PaymentIntentResult = {
  provider: StorefrontPaymentMethod;
  status: "pending_collection";
  reference: string;
};

export interface StorefrontPaymentProvider {
  readonly method: StorefrontPaymentMethod;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
}

export const cashOnDeliveryProvider: StorefrontPaymentProvider = {
  method: "cash_on_delivery",
  async createIntent(input) {
    if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("قيمة الدفع غير صالحة");
    return { provider: "cash_on_delivery", status: "pending_collection", reference: input.orderReference };
  },
};

export function getPaymentProvider(method: StorefrontPaymentMethod): StorefrontPaymentProvider {
  if (method === "cash_on_delivery") return cashOnDeliveryProvider;
  throw new Error("وسيلة الدفع غير مدعومة");
}
