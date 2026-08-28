"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/use-translation";

interface AutoPrintShellProps {
  /** Rendered content when ready */
  children: ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Canonical English error message */
  error?: string | null;
  /** Back link when error */
  backHref?: string;
  /** Canonical English back link label */
  backLabel?: string;
  /** Auto-print delay in ms (default 350) */
  autoPrintDelayMs?: number;
}

/**
 * Shared print view shell:
 * - Shows localized loading/error states
 * - Auto-triggers window.print() after short delay when ready
 * - Wraps content in print-stage for screen preview styling
 */
export function AutoPrintShell({
  children,
  loading = false,
  error = null,
  backHref = "/",
  backLabel = "Back",
  autoPrintDelayMs = 350,
}: AutoPrintShellProps) {
  const { t, language } = useTranslation();
  const ready = !loading && !error;

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, autoPrintDelayMs);
    return () => window.clearTimeout(timer);
  }, [ready, autoPrintDelayMs]);

  if (error) {
    return (
      <div
        dir={language === "ar" ? "rtl" : "ltr"}
        className="grid min-h-screen place-items-center gap-4 p-6 text-center"
      >
        <p className="text-sm text-muted-foreground">{t(error)}</p>
        <Link
          href={backHref}
          className="rounded-xl border bg-white px-4 py-2 text-sm font-medium"
        >
          {t(backLabel)}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        dir={language === "ar" ? "rtl" : "ltr"}
        className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground"
      >
        {t("Preparing print page…")}
      </div>
    );
  }

  return <div className="print-stage" dir={language === "ar" ? "rtl" : "ltr"}>{children}</div>;
}
