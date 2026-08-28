"use client";

import { AlertTriangle } from "lucide-react";
import { PosLogoutButton } from "@/modules/pos/components/pos-logout-button";
import {
  POS_READINESS_COPY,
  type PosReadinessState,
} from "@/lib/auth/pos-readiness-copy";

interface PosAccessDeniedProps {
  state: PosReadinessState;
}

export function PosAccessDenied({ state }: PosAccessDeniedProps) {
  const copy = POS_READINESS_COPY[state];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-end gap-3 border-b px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:py-3">
        <PosLogoutButton />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6">
        <div className="w-full max-w-md space-y-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-center sm:p-4">
          <AlertTriangle className="mx-auto size-8 text-destructive" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">{copy.title}</h1>
            <p className="text-xs text-muted-foreground">{copy.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
