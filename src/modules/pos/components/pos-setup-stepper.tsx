"use client";

import { cn } from "@/lib/utils";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
import { useTranslation } from "@/lib/i18n/use-translation";

const SETUP_STEPS = [
  { id: "store", label: "Store" },
  { id: "session", label: "Session" },
] as const;

function activeStepIndex(state: PosReadinessState): number {
  if (
    state === "store_required" ||
    state === "store_mismatch" ||
    state === "access_denied" ||
    state === "role_denied" ||
    state === "no_device" ||
    state === "device_inactive" ||
    state === "login_required"
  ) {
    return 0;
  }
  return 1;
}

interface PosSetupStepperProps {
  state: PosReadinessState;
  className?: string;
}

export function PosSetupStepper({ state, className }: PosSetupStepperProps) {
  const { t } = useTranslation();
  const active = activeStepIndex(state);

  return (
    <div className={cn("mx-auto w-full max-w-md", className)}>
      <ol className="mb-2 flex items-center gap-1.5">
        {SETUP_STEPS.map((step, index) => {
          const done = index < active;
          const current = index === active;
          return (
            <li
              key={step.id}
              className="flex flex-1 flex-col items-center gap-1"
              aria-current={current ? "step" : undefined}
            >
              <div
                className={cn(
                  "h-1 w-full rounded-full transition-colors",
                  done || current ? "bg-primary" : "bg-muted"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  current ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {index + 1}. {t(step.label)}
              </span>
              {current ? (
                <span className="sr-only">
                  {t("Step")} {index + 1} {t("of")} {SETUP_STEPS.length}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
