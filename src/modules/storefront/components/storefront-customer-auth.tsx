"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StorefrontOAuthProvider } from "../core/customer-auth";

const providerOptions: {
  provider: StorefrontOAuthProvider;
  label: string;
  mark: string;
}[] = [
  { provider: "google", label: "Google", mark: "G" },
  { provider: "apple", label: "Apple", mark: "" },
  { provider: "facebook", label: "Facebook", mark: "f" },
];

export function StorefrontCustomerAuth({
  slug,
  token,
  previewToken,
  nextPath = "checkout",
  initialError = "",
  signedInAs = null,
}: {
  slug: string;
  token?: string | null;
  previewToken?: string | null;
  nextPath?: "account" | "checkout";
  initialError?: string;
  signedInAs?: string | null;
}) {
  const [error, setError] = useState(
    initialError ? "تعذر إكمال تسجيل الدخول. جرّب مرة أخرى أو أكمل كضيف." : "",
  );
  const [pending, setPending] = useState<string | null>(null);
  async function signIn(provider: StorefrontOAuthProvider) {
    setPending(provider);
    setError("");
    const params = new URLSearchParams();
    if (previewToken) params.set("preview", previewToken);
    if (token) params.set("token", token);
    const next = `/store/${encodeURIComponent(slug)}/${nextPath}${params.size ? `?${params}` : ""}`;
    const redirectTo = `${window.location.origin}/store-auth/callback?slug=${encodeURIComponent(slug)}&next=${encodeURIComponent(next)}`;
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (authError) {
      setError("تعذر بدء تسجيل الدخول. جرّب طريقة أخرى أو أكمل كضيف.");
      setPending(null);
    }
  }
  if (signedInAs)
    return (
      <section
        aria-label="حساب العميل"
        className="rounded-2xl border border-[var(--sf-border)] bg-[#F1EDFF] p-4"
      >
        <p className="font-extrabold text-[var(--sf-primary)]">
          تم تسجيل الدخول
        </p>
        <p className="mt-1 text-sm text-[var(--sf-muted)]" dir="ltr">
          {signedInAs}
        </p>
      </section>
    );
  return (
    <section
      aria-labelledby="customer-auth-title"
      className="rounded-2xl border border-[var(--sf-border)] bg-white p-5"
    >
      <h2 id="customer-auth-title" className="text-lg font-black">
        سجّل لتسريع طلباتك القادمة
      </h2>
      <p className="mt-1 text-sm text-[var(--sf-muted)]">
        حسابك اختياري؛ تقدر تكمل الطلب كضيف بدون تسجيل.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {providerOptions.map((option) => (
          <button
            key={option.provider}
            type="button"
            disabled={pending !== null}
            onClick={() => signIn(option.provider)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--sf-border)] bg-white px-3 text-sm font-extrabold hover:bg-[#F8F6FF] disabled:opacity-50"
          >
            <span aria-hidden className="text-lg">
              {option.mark}
            </span>
            {pending === option.provider ? "جاري التحويل..." : option.label}
          </button>
        ))}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-3 text-sm font-bold text-[var(--sf-danger)]"
        >
          {error}
        </p>
      ) : null}
      <div className="my-4 flex items-center gap-3 text-xs text-[var(--sf-muted)]">
        <span className="h-px flex-1 bg-[var(--sf-border)]" />
        <span>أو أكمل كضيف</span>
        <span className="h-px flex-1 bg-[var(--sf-border)]" />
      </div>
    </section>
  );
}
