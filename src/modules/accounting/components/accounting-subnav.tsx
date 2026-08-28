"use client";

import Link from "next/link";
import { useDisplayPathname } from "@/hooks/use-display-pathname";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CircleDollarSign,
  FileSpreadsheet,
  Landmark,
  ScrollText,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlPostingFailureBanner } from "@/modules/accounting/components/gl-posting-failure-banner";

const LINKS = [
  {
    href: "/accounting/accounts",
    label: "دليل الحسابات",
    hint: "الشجرة",
    icon: Landmark,
    match: (path: string) =>
      path === "/accounting/accounts" || path.startsWith("/accounting/accounts/"),
  },
  {
    href: "/accounting/journals",
    label: "القيود",
    hint: "يومي / أوتو",
    icon: ScrollText,
    match: (path: string) => path.startsWith("/accounting/journals"),
  },
  {
    href: "/accounting/trial-balance",
    label: "ميزان المراجعة",
    hint: "أرصدة الفترة",
    icon: BarChart3,
    match: (path: string) => path.startsWith("/accounting/trial-balance"),
  },
  {
    href: "/accounting/ledger",
    label: "دفتر الأستاذ",
    hint: "حركة حساب",
    icon: BookOpen,
    match: (path: string) => path.startsWith("/accounting/ledger"),
  },
  {
    href: "/accounting/income-statement",
    label: "قائمة الدخل",
    hint: "ربح الفترة",
    icon: FileSpreadsheet,
    match: (path: string) => path.startsWith("/accounting/income-statement"),
  },
  {
    href: "/accounting/balance-sheet",
    label: "الميزانية",
    hint: "مركز مالي",
    icon: CircleDollarSign,
    match: (path: string) => path.startsWith("/accounting/balance-sheet"),
  },
  {
    href: "/expenses",
    label: "المصروفات",
    hint: "تشغيل",
    icon: Wallet,
    match: (path: string) => path.startsWith("/expenses"),
  },
  {
    href: "/monthly-closing",
    label: "الإقفال الشهري",
    hint: "قفل الفترة",
    icon: CalendarCheck,
    match: (path: string) => path.startsWith("/monthly-closing"),
  },
] as const;

export function AccountingSubnav() {
  const pathname = useDisplayPathname();

  return (
    <div className="space-y-4" dir="rtl">
      <GlPostingFailureBanner />
      <nav
        aria-label="تنقل الحسابات"
        className="grid grid-cols-2 gap-2 xl:grid-cols-4"
      >
        {LINKS.map((link) => {
          const Icon = link.icon;
          const active = link.match(pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-[var(--mds-radius-lg)] border px-2 py-2.5 transition-colors sm:items-start sm:gap-3 sm:px-3 sm:py-3",
                active
                  ? "border-primary/40 bg-primary/5 shadow-[var(--mds-elevation-1)]"
                  : "border-border/70 bg-card hover:border-primary/25 hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-[var(--mds-radius-md)] sm:mt-0.5 sm:size-9",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-5 sm:text-sm">{link.label}</span>
                <span className="block truncate text-xs leading-4 text-muted-foreground">
                  {link.hint}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
