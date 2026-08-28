"use client";

import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Lock } from "lucide-react";
import { PinPad } from "@/modules/auth/components/pin-pad";
import { PosLogoutButton } from "@/modules/pos/components/pos-logout-button";
import { useTranslation } from "@/lib/i18n/use-translation";

interface PosCashierPinGateProps {
  currentUserName?: string | null;
  onSuccess?: () => void;
}

export function PosCashierPinGate({ currentUserName, onSuccess }: PosCashierPinGateProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Lock className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{t("Cashier locked")}</span>
        </div>
        <PosLogoutButton />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-y-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-5">
        <div className="w-full max-w-md space-y-3 rounded-xl border bg-card p-3.5 shadow-md ring-1 ring-foreground/5 sm:space-y-4 sm:p-4">
          <div className="space-y-1 text-center">
            <h1 className="text-lg font-semibold tracking-tight">{t("Cashier PIN")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("Enter your 4-digit PIN to open the POS.")}
            </p>
            {currentUserName ? (
              <p className="text-xs text-muted-foreground">
                {t("Signed in:")}{" "}
                <span className="font-medium text-foreground">{currentUserName}</span>
              </p>
            ) : null}
          </div>
          <PinPad
            onSuccess={() => {
              onSuccess?.();
              router.refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}
