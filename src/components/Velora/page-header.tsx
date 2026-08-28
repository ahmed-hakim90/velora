import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LocalizedText } from "@/components/Velora/localized-text";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
  meta,
  className,
}: PageHeaderProps) {
  const hasSubtitle = Boolean(breadcrumb || description);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-border/70 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pb-2.5",
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h1
          className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg"
          suppressHydrationWarning
        >
          <LocalizedText text={title} />
        </h1>
        {hasSubtitle ? (
          <div className="flex min-w-0 max-h-4 flex-wrap items-center gap-x-1.5 overflow-hidden text-xs leading-snug text-muted-foreground sm:max-h-none">
            {breadcrumb ? (
              <span className="font-medium text-[var(--mds-color-text-secondary)]">
                {breadcrumb}
              </span>
            ) : null}
            {breadcrumb && description ? (
              <span aria-hidden className="text-border">
                ·
              </span>
            ) : null}
            {description ? <LocalizedText text={description} /> : null}
          </div>
        ) : null}
        {meta}
      </div>
      {action ? (
        <div className="flex w-full shrink-0 touch-pan-x flex-row flex-nowrap items-center justify-start gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-none sm:w-auto sm:justify-end sm:gap-2 [&_a]:min-h-11 [&_a]:shrink-0 sm:[&_a]:min-h-9 [&_button]:min-h-11 [&_button]:shrink-0 sm:[&_button]:min-h-9">
          {action}
        </div>
      ) : null}
    </div>
  );
}
