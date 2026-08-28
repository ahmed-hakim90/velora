import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOnlineMenuSlug } from "@/lib/slugify";
import {
  isStorefrontOAuthProvider,
  resolveStorefrontAuthNext,
} from "@/modules/storefront/core/customer-auth";

function authErrorUrl(next: string, code: string, origin: string): URL {
  const target = new URL(next, origin);
  target.searchParams.set("auth_error", code);
  return target;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = normalizeOnlineMenuSlug(url.searchParams.get("slug") ?? "");
  const code = url.searchParams.get("code");
  if (!slug || !code) return NextResponse.redirect(new URL("/", url.origin));
  const next = resolveStorefrontAuthNext(slug, url.searchParams.get("next"));
  const auth = await createClient();
  const { data, error } = await auth.auth.exchangeCodeForSession(code);
  if (error || !data.user)
    return NextResponse.redirect(authErrorUrl(next, "1", url.origin));

  const admin = createAdminClient();
  const { data: store } = await admin
    .from("stores")
    .select("org_id")
    .eq("is_active", true)
    .filter("settings->>storefront_slug", "eq", slug)
    .maybeSingle();
  if (!store) {
    await auth.auth.signOut();
    return NextResponse.redirect(new URL("/", url.origin));
  }
  const rawProvider = String(data.user.app_metadata.provider ?? "");
  if (!isStorefrontOAuthProvider(rawProvider)) {
    await auth.auth.signOut();
    return NextResponse.redirect(authErrorUrl(next, "provider", url.origin));
  }
  const email = data.user.email?.trim().toLowerCase() || null;
  const displayName = String(
    data.user.user_metadata.full_name ?? data.user.user_metadata.name ?? "",
  )
    .trim()
    .slice(0, 120);
  let customerId: string | null = null;
  if (email) {
    const { data: customer } = await admin
      .from("customers")
      .select("id")
      .eq("org_id", store.org_id)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    customerId = customer?.id ?? null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: accountError } = await (admin as any)
    .from("storefront_customer_accounts")
    .upsert(
      {
        org_id: store.org_id,
        auth_user_id: data.user.id,
        customer_id: customerId,
        provider: rawProvider,
        email,
        display_name: displayName,
        updated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      },
      { onConflict: "org_id,auth_user_id" },
    );
  if (accountError) {
    await auth.auth.signOut();
    return NextResponse.redirect(authErrorUrl(next, "account", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
