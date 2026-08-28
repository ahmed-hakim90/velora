"use client";

import Link from "next/link";
import { PageHeader } from "@/components/Velora/page-header";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ReportPageProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ReportPage({
  title,
  description,
  actions,
  filters,
  children,
  className,
}: ReportPageProps) {
  const { t, language } = useTranslation();

  return (
    <div className={cn("flex flex-col gap-3", className)} dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        breadcrumb={
          <Link href="/reports" className="text-primary hover:underline">
            {t("Reports")}
          </Link>
        }
        title={title}
        description={description}
        action={actions}
      />
      {filters ? <div className="print:hidden min-w-0">{filters}</div> : null}
      {children}
    </div>
  );
}
