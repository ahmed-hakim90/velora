"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import {
  STOREFRONT_ORDER_STATUSES,
  type StorefrontOrderStatus,
} from "../core/order-lifecycle";
import { transitionStorefrontOrder } from "../services/storefront-order-admin.service";

export async function transitionStorefrontOrderAction(
  orderId: string,
  status: StorefrontOrderStatus,
) {
  if (
    !STOREFRONT_ORDER_STATUSES.includes(status) ||
    !/^[0-9a-f-]{36}$/i.test(orderId)
  )
    throw new Error("طلب غير صالح");
  const user =
    status === "cancelled"
      ? await requirePermissionOrRole("order_void", ["owner", "manager"])
      : await requirePermissionOrRole("checkout_create", [
          "owner",
          "manager",
          "cashier",
        ]);
  await transitionStorefrontOrder(orderId, status, user.id);
  revalidatePath("/storefront/orders");
}
