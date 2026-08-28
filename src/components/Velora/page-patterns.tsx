import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LocalizedText } from "@/components/Velora/localized-text";

export function PageShell({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-[var(--mds-space-5)]", className)}
      {...props}
    />
  );
}

export function EntityList({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card",
        className
      )}
      {...props}
    />
  );
}

export function DetailLayout({
  main,
  aside,
  className,
}: {
  main: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-[var(--mds-space-5)] xl:grid-cols-[minmax(0,1fr)_20rem]",
        className
      )}
    >
      <div className="min-w-0">{main}</div>
      {aside ? <aside className="min-w-0">{aside}</aside> : null}
    </div>
  );
}

export function FilterBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-[var(--mds-space-3)] border-b border-border bg-card p-[var(--mds-space-4)] sm:flex-row sm:flex-wrap sm:items-center",
        className
      )}
      {...props}
    />
  );
}

export function FormLayout({ className, ...props }: ComponentProps<"form">) {
  return (
    <form
      className={cn(
        "grid min-w-0 gap-[var(--mds-space-5)] md:grid-cols-2 [&_[data-form-span=full]]:md:col-span-2",
        className
      )}
      {...props}
    />
  );
}

export function StateView({
  title,
  description,
  action,
  tone = "neutral",
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "neutral" | "danger" | "warning";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center rounded-[var(--mds-radius-lg)] border border-dashed p-[var(--mds-space-8)] text-center",
        tone === "neutral" && "border-border bg-card",
        tone === "warning" &&
          "border-[var(--mds-color-feedback-warning-border)] bg-[var(--mds-color-feedback-warning-subtle)]",
        tone === "danger" &&
          "border-[var(--mds-color-feedback-danger-border)] bg-[var(--mds-color-feedback-danger-subtle)]",
        className
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <p className="text-base font-semibold text-foreground"><LocalizedText text={title} /></p>
      {description ? (
        <p className="mt-[var(--mds-space-1)] max-w-prose text-sm text-muted-foreground">
          <LocalizedText text={description} />
        </p>
      ) : null}
      {action ? <div className="mt-[var(--mds-space-4)]">{action}</div> : null}
    </div>
  );
}
