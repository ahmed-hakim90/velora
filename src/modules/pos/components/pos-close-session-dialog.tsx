"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CloseSessionStepper } from "@/modules/sessions/components/close-session-stepper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SessionReconciliation } from "@/modules/sessions/services/reconciliation.service";
import type { CashierSession, Expense } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

interface PosCloseSessionDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  session: CashierSession;
  reconciliation: SessionReconciliation;
  sessionExpenses: Expense[];
  cashierName: string;
  costCenterMap?: Record<string, string>;
  categoryMap?: Record<string, string>;
  triggerChildren?: ReactNode;
  triggerClassName?: string;
  triggerSize?: "default" | "sm" | "lg" | "icon";
  triggerVariant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
}

type SessionCashResponse = {
  sessionId?: string;
  reconciliation: SessionReconciliation;
  expenses: Expense[];
  error?: string;
};

export function PosCloseSessionDialog({
  open: controlledOpen,
  onOpenChange,
  session,
  reconciliation: initialReconciliation,
  sessionExpenses: initialExpenses,
  cashierName,
  costCenterMap,
  categoryMap,
  triggerChildren,
  triggerClassName = "rounded-full",
  triggerSize = "sm",
  triggerVariant = "outline",
}: PosCloseSessionDialogProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reconciliation, setReconciliation] =
    useState<SessionReconciliation>(initialReconciliation);
  const [sessionExpenses, setSessionExpenses] = useState<Expense[]>(initialExpenses);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ sessionId: session.id });
        const res = await fetch(`/api/pos/session-cash?${params.toString()}`, {
          cache: "no-store",
        });
        const body = (await res.json()) as SessionCashResponse;
        if (!res.ok) {
          throw new Error(body.error ?? "Could not load session summary");
        }
        if (body.sessionId && body.sessionId !== session.id) {
          throw new Error("A different session summary was loaded. Refresh and try again.");
        }
        if (cancelled) return;
        setReconciliation(body.reconciliation);
        setSessionExpenses(body.expenses ?? []);
      } catch (error) {
        if (cancelled) return;
        setLoadError(t(error instanceof Error ? error.message : "Could not load session summary"));
        setReconciliation(initialReconciliation);
        setSessionExpenses(initialExpenses);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, session.id, initialReconciliation, initialExpenses, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size={triggerSize}
        variant={triggerVariant}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerChildren ?? t("Close session")}
      </Button>
      <DialogContent className="flex max-h-[min(96dvh,100%)] max-w-[min(720px,calc(100%-0.5rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-3 py-2.5 pe-10 sm:px-4 sm:pe-10">
          <DialogTitle className="text-base">{t("Close cashier session")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-3 sm:pb-3">
          {loading ? (
            <p className="py-5 text-center text-xs text-muted-foreground">
              {t("Loading sales summary…")}
            </p>
          ) : (
            <>
              {loadError ? (
                <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  {loadError} — {t("Showing the last saved summary.")}
                </p>
              ) : null}
              <CloseSessionStepper
                session={session}
                reconciliation={reconciliation}
                sessionExpenses={sessionExpenses}
                cashierName={cashierName}
                costCenterMap={costCenterMap}
                categoryMap={categoryMap}
                embedded
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
