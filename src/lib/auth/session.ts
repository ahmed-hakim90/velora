import { cache } from "react";
import { cookies } from "next/headers";
import * as userRepo from "@/lib/repositories/user.repository";
import { createSignedCookieValue, readSignedCookieValue } from "@/lib/auth/signed-cookie";
import { getAuthUserId } from "@/lib/auth/auth-user";
import { isOrganizationSuspended } from "@/lib/org-status";
import type { AppUser } from "@/lib/types";

export const STORE_COOKIE = "sf_active_store";
export const CASHIER_COOKIE = "sf_active_cashier";

const STORE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const CASHIER_COOKIE_MAX_AGE = 60 * 60 * 12;

/** Deduped per request — auth + users row + org status. */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const authUserId = await getAuthUserId();
  if (!authUserId) return null;
  const appUser = await userRepo.getUserByAuthId(authUserId);
  if (appUser && (await isOrganizationSuspended(appUser.org_id))) return null;
  return appUser;
});

/** HMAC-verified active store id (ADR-002). Still re-validate store∈org via requireStoreAccess. */
export async function getActiveStoreId(): Promise<string | null> {
  const cookieStore = await cookies();
  const payload = readSignedCookieValue<{ storeId?: string }>(
    cookieStore.get(STORE_COOKIE)?.value
  );
  return payload?.storeId ?? null;
}

export async function setActiveStoreCookie(storeId: string) {
  const cookieStore = await cookies();
  cookieStore.set(
    STORE_COOKIE,
    createSignedCookieValue({ storeId }, STORE_COOKIE_MAX_AGE),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: STORE_COOKIE_MAX_AGE,
    }
  );
}

export async function clearActiveStoreCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(STORE_COOKIE);
}

export async function getActiveCashierId(
  storeId: string,
  _user?: unknown,
): Promise<string | null> {
  void _user;
  const cookieStore = await cookies();
  const payload = readSignedCookieValue<{
    cashierId?: string;
    storeId?: string;
  }>(cookieStore.get(CASHIER_COOKIE)?.value);

  if (
    payload?.cashierId &&
    payload.storeId === storeId
  ) {
    return payload.cashierId;
  }
  return null;
}

export async function setActiveCashierId(
  cashierId: string | null,
  input?: { storeId: string }
) {
  const cookieStore = await cookies();
  if (cashierId && input) {
    cookieStore.set(
      CASHIER_COOKIE,
      createSignedCookieValue(
        { cashierId, storeId: input.storeId },
        CASHIER_COOKIE_MAX_AGE
      ),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: CASHIER_COOKIE_MAX_AGE,
      }
    );
  } else {
    cookieStore.delete(CASHIER_COOKIE);
  }
}
