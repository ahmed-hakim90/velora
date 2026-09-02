"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { roundMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";
import { closeSessionAction } from "@/modules/sessions/actions/session.actions";
import type { SessionReconciliation } from "@/modules/sessions/services/reconciliation.service";
import {
  getSessionReconciliationVersion,
  type CloseSessionResult,
} from "@/modules/sessions/types/session-close";
import type { CashierSession, Expense } from "@/lib/types";

interface CloseSessionStepperProps {
  session: CashierSession;
  reconciliation: SessionReconciliation;
  sessionExpenses: Expense[];
  cashierName: string;
  costCenterMap?: Record<string, string>;
  categoryMap?: Record<string, string>;
  embedded?: boolean;
}

function formatClosingMoney(
  value: number,
  language: "ar" | "en",
  prefix = ""
): string {
  const number = new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: "latn",
  }).format(value);
  return `${prefix}${number} ${language === "ar" ? "ج.م." : "EGP"}`;
}

export function CloseSessionStepper({
  session,
  reconciliation: initialReconciliation,
  sessionExpenses: initialExpenses,
  cashierName,
  costCenterMap = {},
  categoryMap = {},
  embedded = false,
}: CloseSessionStepperProps) {
  const { t, language } = useTranslation();
  const [step, setStep] = useState<0 | 1>(0);
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [reconciliation, setReconciliation] = useState(initialReconciliation);
  const [sessionExpenses, setSessionExpenses] = useState(initialExpenses);
  const [result, setResult] = useState<CloseSessionResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsedActual = Number(actualCash);
  const validActual = actualCash.trim() !== "" && Number.isFinite(parsedActual) && parsedActual >= 0;
  const actual = validActual ? roundMoney(parsedActual) : 0;
  const variance = useMemo(
    () => roundMoney(actual - reconciliation.expectedCash),
    [actual, reconciliation.expectedCash]
  );
  const locale = language === "ar" ? "ar-EG" : "en-US";

  function submitClose() {
    if (!validActual) {
      setFormError(t("Enter a valid cash amount of zero or more."));
      return;
    }

    setFormError(null);
    startTransition(async () => {
      try {
        const nextResult = await closeSessionAction({
          sessionId: session.id,
          expectedCash: reconciliation.expectedCash,
          reconciliationVersion: getSessionReconciliationVersion(reconciliation),
          actualCash: actual,
          notes: notes || undefined,
        });

        if (nextResult.status === "reconciliation_changed") {
          setReconciliation(nextResult.reconciliation);
          setSessionExpenses(nextResult.expenses);
          setStep(0);
          setFormError(t("Session totals changed. Review the updated summary before closing."));
          return;
        }
        setResult(nextResult);
      } catch (error) {
        setFormError(t(error instanceof Error ? error.message : "Could not close the session"));
      }
    });
  }

  if (result && result.status !== "reconciliation_changed") {
    const vaultPending = result.status === "vault_pending";
    return (
      <div className="flex flex-col items-center gap-4 py-3 text-center" role="status" aria-live="polite">
        <div className={cn("flex size-14 items-center justify-center rounded-2xl ring-1", vaultPending ? "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300")}>
          {vaultPending ? <AlertTriangle className="size-7" aria-hidden /> : <CheckCircle2 className="size-7" aria-hidden />}
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{vaultPending ? t("Session closed — vault transfer pending") : t("Session closed")}</h3>
          {vaultPending ? <p className="max-w-md text-sm leading-6 text-muted-foreground">{t(result.message)}</p> : null}
        </div>
        <dl className="grid w-full grid-cols-3 gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
          {[[t("Expected"), result.expectedCash], [t("Actual"), result.actualCash], [t("Variance"), result.variance]].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                <bdi dir="ltr">{formatClosingMoney(Number(value), language)}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {vaultPending ? (
            <Button className="h-11 rounded-xl" disabled={pending} onClick={submitClose}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              {t("Retry vault transfer")}
            </Button>
          ) : (
            <Button
              render={<a href={`/print/sessions/${session.id}/closing`} target="_blank" rel="noreferrer" />}
              className="h-11 rounded-xl"
            >
                <Printer className="size-4" aria-hidden />
                {t("Print closing report")}
            </Button>
          )}
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => window.location.reload()}>{t("Back to POS")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("text-card-foreground", embedded ? "bg-transparent p-0" : "rounded-[var(--mds-radius-lg)] border border-border bg-card p-4 shadow-[var(--mds-elevation-1)] sm:p-[var(--mds-space-6)]")}>
      <ol className={cn("grid grid-cols-2 gap-2", embedded ? "mb-3" : "mb-5")} aria-label={t("Closing progress")}>
        {[t("Session summary"), t("Count and confirm")].map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined} className={cn("rounded-lg border px-2 py-1.5 text-center text-xs font-medium", index <= step ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground")}>
            <span className="me-1 tabular-nums">{index + 1}</span>{label}
          </li>
        ))}
      </ol>

      {formError ? <div className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100" role="alert">{formError}</div> : null}

      {step === 0 ? (
        <div className={cn(embedded ? "space-y-2.5" : "space-y-4")}>
          <div className="space-y-1">
            <h3 className={cn("font-heading font-semibold", embedded ? "text-base" : "text-lg")}>{t("Session summary")}</h3>
            <p className={cn("text-muted-foreground", embedded ? "text-xs" : "text-sm")}>{t("Cashier")}: {cashierName}</p>
            <p className={cn("text-muted-foreground", embedded ? "text-xs" : "text-sm")}>{t("Opened at")} {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.opened_at))}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <dl className={cn("rounded-xl border border-border/60 bg-muted/20 text-sm", embedded ? "space-y-1.5 p-2.5" : "space-y-2 p-3")}>
              <div className="mb-2 text-xs font-semibold text-foreground">{t("Sales overview")}</div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("Total sales")}</dt>
                <dd className="tabular-nums"><bdi dir="ltr">{formatClosingMoney(reconciliation.totalSales, language)}</bdi></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("Order count")}</dt>
                <dd className="tabular-nums">{reconciliation.orderCount}</dd>
              </div>
            </dl>

            <dl className={cn("rounded-xl border border-primary/20 bg-primary/5 text-sm", embedded ? "space-y-1.5 p-2.5" : "space-y-2 p-3")}>
              <div className="mb-2 text-xs font-semibold text-foreground">{t("Cash drawer calculation")}</div>
              {[
                [t("Opening cash"), reconciliation.openingCash, ""],
                [t("Cash sales"), reconciliation.cashSales, reconciliation.cashSales > 0 ? "+" : ""],
                ...(reconciliation.cashRefunds > 0 ? [[t("Cash refunds"), reconciliation.cashRefunds, "-"]] : []),
                ...(reconciliation.expenses > 0 ? [[t("Expenses"), reconciliation.expenses, "-"]] : []),
                ...(reconciliation.supplierPayments > 0 ? [[t("Supplier payments"), reconciliation.supplierPayments, "-"]] : []),
              ].map(([label, value, prefix]) => (
                <div key={String(label)} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums"><bdi dir="ltr">{formatClosingMoney(Number(value), language, String(prefix))}</bdi></dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-primary/15 pt-2 font-semibold">
                <dt>{t("Expected cash")}</dt>
                <dd className="text-primary tabular-nums"><bdi dir="ltr">{formatClosingMoney(reconciliation.expectedCash, language)}</bdi></dd>
              </div>
            </dl>
          </div>

          {sessionExpenses.length > 0 ? (
            <div className={cn(embedded ? "space-y-1" : "space-y-2")}>
              <p className="text-xs font-medium">{t("Session Expenses")}</p>
              <ul className={cn("overflow-y-auto", embedded ? "max-h-24 space-y-1" : "max-h-40 space-y-2")}>
                {sessionExpenses.map((expense) => (
                  <li key={expense.id} className="rounded-lg bg-muted/50 px-2 py-1.5 text-sm">
                    <div className="flex justify-between gap-2"><span className="font-medium">{expense.title}</span><span className="shrink-0 font-medium tabular-nums"><bdi dir="ltr">{formatClosingMoney(expense.amount, language)}</bdi></span></div>
                    <p className="mt-1 text-xs text-muted-foreground">{costCenterMap[expense.cost_center_id] ?? "—"} · {categoryMap[expense.expense_category_id] ?? "—"}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={cn(embedded ? "space-y-3" : "space-y-4")}>
          <div className="space-y-2">
            <h3 className={cn("font-heading font-semibold", embedded ? "text-base" : "text-lg")}>
              {t("Count actual cash")}
            </h3>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5" aria-live="polite">
              <span className="text-sm font-medium text-muted-foreground">
                {t("Expected cash")}
              </span>
              <strong className="text-xl font-bold text-primary tabular-nums">
                <bdi dir="ltr">{formatClosingMoney(reconciliation.expectedCash, language)}</bdi>
              </strong>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`actual-cash-${session.id}`}>{t("Amount in drawer")}</Label>
            <Input id={`actual-cash-${session.id}`} type="number" inputMode="decimal" min={0} step="0.01" value={actualCash} onChange={(event) => { setActualCash(event.target.value); setFormError(null); }} aria-invalid={actualCash !== "" && !validActual} className="h-12 rounded-xl text-lg" placeholder="0.00" autoFocus />
            {actualCash !== "" && !validActual ? <p className="text-xs text-destructive">{t("Enter a valid cash amount of zero or more.")}</p> : null}
          </div>
          {validActual ? (
            <div className={cn("rounded-xl border p-3", variance === 0 ? "border-emerald-500/25 bg-emerald-500/10" : variance < 0 ? "border-destructive/25 bg-destructive/5" : "border-amber-500/30 bg-amber-500/10")} role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {t("Variance")} · {variance === 0 ? t("Matched") : variance < 0 ? t("Shortage") : t("Overage")}
                </span>
                <strong className={cn("text-xl tabular-nums", variance === 0 ? "text-emerald-700 dark:text-emerald-300" : variance < 0 ? "text-destructive" : "text-amber-800 dark:text-amber-200")}>
                  <bdi dir="ltr">{formatClosingMoney(variance, language, variance > 0 ? "+" : "")}</bdi>
                </strong>
              </div>
              {variance !== 0 ? <p className="mt-1 text-xs text-muted-foreground">{t("The variance will be recorded with this closing.")}</p> : null}
            </div>
          ) : null}
          <div className="space-y-1.5"><Label htmlFor={`close-notes-${session.id}`}>{t("Notes (optional)")}</Label><Textarea id={`close-notes-${session.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} className="rounded-xl" rows={embedded ? 2 : 3} /></div>
        </div>
      )}

      <div className={cn("grid grid-cols-2 gap-2", embedded ? "sticky bottom-0 z-10 -mx-1 mt-3 border-t border-border/60 bg-background/95 px-1 py-2 backdrop-blur" : "mt-6")}>
        {step === 0 ? null : <Button variant="outline" className="h-11 rounded-xl" disabled={pending} onClick={() => { setStep(0); setFormError(null); }}>{t("Back")}</Button>}
        {step === 0 ? <Button className="col-span-2 h-11 rounded-xl" onClick={() => { setStep(1); setFormError(null); }}>{t("Continue to cash count")}</Button> : <Button className="h-11 rounded-xl" disabled={pending || !validActual} onClick={submitClose}>{pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{pending ? t("Closing session…") : t("Confirm close")}</Button>}
      </div>
    </div>
  );
}
