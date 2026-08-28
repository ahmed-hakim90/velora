"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { PinPad } from "@/modules/auth/components/pin-pad";
import {
  loginWithPosPinAction,
  preparePosPinLoginAction,
} from "@/modules/auth/actions/pos-pin-login.actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";

interface PosPinLoginGateProps {
  storeSlug: string;
  storeName?: string | null;
}

/** Public PIN gate for `/{slug}/pos` — PIN mints a full cashier session. */
export function PosPinLoginGate({ storeSlug, storeName }: PosPinLoginGateProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [ready, setReady] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState(storeName ?? "");
  const [posPath, setPosPath] = useState(`/${storeSlug}/pos`);

  useEffect(() => {
    startTransition(async () => {
      const ctx = await preparePosPinLoginAction({ storeSlug });
      if (!ctx.ok) {
        setBlockingError(ctx.message);
        setReady(false);
        return;
      }
      setResolvedName(ctx.storeName);
      setPosPath(ctx.posPath);
      setBlockingError(null);
      setReady(true);
    });
  }, [storeSlug]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Lock className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">
            {t("Cashier login")}{resolvedName ? ` — ${resolvedName}` : ""}
          </span>
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-11 min-w-11 rounded-full px-3")}
        >
          {t("Manager login")}
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-5">
        <div className="w-full max-w-md space-y-3 rounded-xl border bg-card p-3.5 shadow-md ring-1 ring-foreground/5 sm:space-y-4 sm:p-4">
          <div className="space-y-1 text-center">
            <h1 className="text-lg font-semibold tracking-tight">{t("Cashier PIN")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("Enter your PIN to open the POS — no email or password needed.")}
            </p>
            <p className="font-mono text-xs text-muted-foreground" dir="ltr">
              {posPath}
            </p>
          </div>

          {blockingError && !ready ? (
            <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
              <p>{blockingError}</p>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-xl")}
              >
                {t("Manager login")}
              </Link>
            </div>
          ) : (
            <PinPad
              disabled={pending || !ready}
              verifyPin={async (pin) => {
                const result = await loginWithPosPinAction({ pin, storeSlug });
                if (!result.success) {
                  return { success: false, error: t(result.error ?? "Invalid PIN") };
                }
                toast.success(t("POS opened"));
                window.location.assign(result.posPath ?? posPath);
                return { success: true };
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
