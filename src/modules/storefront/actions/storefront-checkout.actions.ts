"use server";

import { z } from "zod";
import { getPaymentProvider } from "../core/payment";
import { submitStorefrontOrder } from "../services/storefront-order.service";

const checkoutSchema = z.object({
  slug: z.string().trim().min(2).max(120),
  token: z.string().nullable().optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(5).max(40),
  customerEmail: z.email().max(160).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
  zoneId: z.string().nullable().optional(),
  fulfillmentType: z.enum(["pickup", "delivery"]),
  paymentMethod: z.literal("cash_on_delivery"),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(50),
}).superRefine((value, context) => {
  if (value.fulfillmentType === "delivery" && (!value.address || value.address.length < 5)) {
    context.addIssue({ code: "custom", path: ["address"], message: "عنوان التوصيل مطلوب" });
  }
});

export type StorefrontCheckoutInput = z.input<typeof checkoutSchema>;

export async function submitStorefrontCheckoutAction(raw: StorefrontCheckoutInput) {
  const input = checkoutSchema.parse(raw);
  const order = await submitStorefrontOrder({
    slug: input.slug,
    token: input.token,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail || null,
    notes: input.notes,
    fulfillmentType: input.fulfillmentType,
    zoneId: input.zoneId,
    address: input.address,
    lines: input.lines,
  });
  const payment = await getPaymentProvider(input.paymentMethod).createIntent({
    method: input.paymentMethod,
    amount: order.total,
    currency: order.currency,
    orderReference: order.id,
  });
  return { ...order, payment };
}
