"use server";

import { revalidatePath } from "next/cache";
import { requireStoreAccess, setActiveStoreCookie } from "@/lib/auth/guards";
import { setActiveCashierId } from "@/lib/auth/session";

export async function setActiveStoreAction(storeId: string) {
  await requireStoreAccess(storeId);
  await setActiveStoreCookie(storeId);
  // Store change locks the register — cashier must enter PIN again.
  await setActiveCashierId(null);
  revalidatePath("/", "layout");
  revalidatePath("/pos");
}
