"use client";

import { useCallback, useState, useTransition } from "react";
import { Delete, CircleDot } from "lucide-react";
import { verifyPinAction } from "@/modules/auth/actions/verify-pin.action";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";

const PIN_LENGTH = 4;

export type PinVerifyResult = {
  success: boolean;
  error?: string;
  cashierId?: string;
};

interface PinPadProps {
  onSuccess?: (cashierId: string) => void;
  /** Override default authenticated PIN switch (e.g. public PIN-as-login). */
  verifyPin?: (pin: string) => Promise<PinVerifyResult>;
  disabled?: boolean;
  className?: string;
}

export function PinPad({ onSuccess, verifyPin, disabled = false, className }: PinPadProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = pending || disabled;

  const appendDigit = useCallback((digit: string) => {
    setError(null);
    setPin((current) => (current.length < PIN_LENGTH ? current + digit : current));
  }, []);

  const removeDigit = useCallback(() => {
    setError(null);
    setPin((current) => current.slice(0, -1));
  }, []);

  const clearPin = useCallback(() => {
    setError(null);
    setPin("");
  }, []);

  const submitPin = useCallback(
    (value: string) => {
      if (value.length !== PIN_LENGTH) return;
      startTransition(async () => {
        const result = verifyPin
          ? await verifyPin(value)
          : await verifyPinAction(value);
        if (result.success) {
          setPin("");
          setError(null);
          onSuccess?.(result.cashierId ?? "");
        } else {
          setError(t(result.error ?? "Invalid PIN."));
          setPin("");
        }
      });
    },
    [onSuccess, t, verifyPin]
  );

  const handleDigit = (digit: string) => {
    if (busy) return;
    const next = pin.length < PIN_LENGTH ? pin + digit : pin;
    appendDigit(digit);
    if (next.length === PIN_LENGTH) {
      submitPin(next);
    }
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

  return (
    <div className={cn("mx-auto w-full max-w-sm space-y-4 sm:space-y-6", className)}>
      <div className="flex justify-center gap-2.5 sm:gap-3">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex size-4 items-center justify-center rounded-full transition-all",
              i < pin.length
                ? "bg-primary shadow-[0_0_12px_-2px_var(--color-primary)]"
                : "border-2 border-muted-foreground/25 bg-transparent"
            )}
          >
            {i < pin.length ? <CircleDot className="size-2.5 text-primary-foreground" /> : null}
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-center text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          {pending ? t("Verifying…") : t("Enter your 4-digit PIN")}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 max-[390px]:gap-1.5 sm:gap-3">
        {digits.map((key) => {
          if (key === "clear") {
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={clearPin}
                className="h-12 rounded-[var(--radius-button)] text-sm font-medium min-[391px]:h-14 sm:h-16"
              >
                {t("Clear")}
              </Button>
            );
          }
          if (key === "back") {
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={removeDigit}
                className="h-12 rounded-[var(--radius-button)] min-[391px]:h-14 sm:h-16"
                aria-label={t("Delete")}
              >
                <Delete className="size-5" />
              </Button>
            );
          }
          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => handleDigit(key)}
              className="h-12 rounded-[var(--radius-button)] text-xl font-medium shadow-sm transition active:scale-95 min-[391px]:h-14 min-[391px]:text-2xl sm:h-16"
            >
              {key}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
