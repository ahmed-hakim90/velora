"use client";

import Link from "next/link";
import { AlertTriangle, Lock, Wallet, Smartphone, Store, LogIn } from "lucide-react";
import {
  POS_READINESS_COPY,
  type PosReadinessState,
} from "@/lib/auth/pos-readiness-copy";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const icons: Partial<
  Record<PosReadinessState, React.ComponentType<{ className?: string }>>
> = {
  login_required: LogIn,
  no_device: Smartphone,
  device_inactive: Lock,
  store_mismatch: Store,
  store_required: Store,
  access_denied: Lock,
  cashier_required: Lock,
  no_session: Wallet,
  session_warning: AlertTriangle,
  session_expired: AlertTriangle,
};

interface PosReadinessBannerProps {
  state: PosReadinessState;
  action?: React.ReactNode;
}

export function PosReadinessBanner({ state, action }: PosReadinessBannerProps) {
  if (state === "ready" || state === "cashier_required") return null;

  const copy = POS_READINESS_COPY[state];
  const Icon = icons[state];
  const isExpired = state === "session_expired";

  return (
    <div
      className={cn(
        "flex min-h-12 w-full shrink-0 items-center justify-between gap-1.5 rounded-lg border px-2 py-0.5 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2",
        isExpired
          ? "border-destructive/40 bg-destructive/10"
          : "border-amber-500/30 bg-amber-500/10"
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
              isExpired ? "text-destructive" : "text-amber-700 dark:text-amber-300"
            )}
          />
        ) : null}
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-[11px] font-semibold sm:text-xs",
              isExpired ? "text-destructive" : "text-amber-900 dark:text-amber-200"
            )}
          >
            {copy.title}
          </p>
          <p
            className={cn(
              "text-[11px] max-sm:sr-only sm:line-clamp-2",
              isExpired ? "text-destructive/90" : "text-amber-800/90 dark:text-amber-200/90"
            )}
          >
            {copy.description}
          </p>
        </div>
      </div>
      {action ? (
        <div className="shrink-0 [&_button]:h-11 [&_button]:rounded-lg [&_p]:hidden sm:[&_p]:block">{action}</div>
      ) : copy.href && copy.cta ? (
        <Link
          href={copy.href}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "h-11 shrink-0 rounded-lg px-2.5 text-xs sm:px-3"
          )}
        >
          {copy.cta}
        </Link>
      ) : null}
    </div>
  );
}
