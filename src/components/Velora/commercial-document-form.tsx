import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LocalizedText } from "@/components/Velora/localized-text";

export function CommercialDocumentForm({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[var(--mds-radius-lg)] border border-border bg-card shadow-[var(--mds-elevation-1)]",
        "pb-16 lg:pb-12",
        className
      )}
      {...props}
    />
  );
}

export function DocumentHeaderGrid({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 gap-[var(--mds-space-3)] sm:grid-cols-2 xl:grid-cols-4",
        "[&_label]:text-xs [&_label]:text-muted-foreground",
        "[&_input]:min-h-11 [&_[role=combobox]]:min-h-11 sm:[&_input]:!min-h-9 sm:[&_input]:!h-9 sm:[&_[role=combobox]]:!min-h-9 sm:[&_[role=combobox]]:!h-9",
        className
      )}
      {...props}
    />
  );
}

export function DocumentLineComposer({
  title = "Add line",
  hint,
  className,
  children,
}: {
  title?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-[var(--mds-radius-lg)] border border-primary/30 bg-[var(--mds-color-harbor-50)]/70 p-[var(--mds-space-3)] shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]",
        "[&_label]:text-xs [&_input]:min-h-11 sm:[&_input]:!min-h-9 sm:[&_input]:!h-9 sm:[&_[role=combobox]]:!min-h-9 sm:[&_[role=combobox]]:!h-9",
        className
      )}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground"><LocalizedText text={title} /></h3>
        {hint ? <p className="text-xs text-muted-foreground"><LocalizedText text={hint} /></p> : null}
      </div>
      {children}
    </section>
  );
}

export function DocumentLinesSection({
  count,
  total,
  children,
  className,
}: {
  count: number;
  total?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 space-y-2 border-t-2 border-primary/25 pt-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold"><LocalizedText text="Line items" /> ({count})</h3>
        {total ? <div className="text-sm font-semibold tabular-nums text-primary">{total}</div> : null}
      </div>
      {children}
    </section>
  );
}
