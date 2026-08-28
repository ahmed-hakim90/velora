import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type MobileEntityField = {
  label: string;
  value: ReactNode;
};

type MobileEntityCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  fields?: MobileEntityField[];
  footer?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** Hint under fields (e.g. «عرض التفاصيل ←») */
  trailingHint?: ReactNode;
};

/**
 * Touch-first list card for &lt;md. Use with {@link ResponsiveListLayout}.
 * Prefer this over inventing page-owned card chrome.
 */
export function MobileEntityCard({
  title,
  subtitle,
  badge,
  fields,
  footer,
  href,
  onClick,
  className,
  trailingHint,
}: MobileEntityCardProps) {
  const body = (
    <>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {fields && fields.length > 0 ? (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {fields.map((field) => (
            <div
              key={field.label}
              className="min-w-0 rounded-[var(--mds-radius-sm)] bg-muted/35 px-2 py-1.5"
            >
              <dt className="truncate text-[11px] text-muted-foreground">{field.label}</dt>
              <dd className="mt-0.5 min-w-0 break-words font-medium text-foreground">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {trailingHint ? (
        <p className="mt-2 text-xs font-medium text-primary">{trailingHint}</p>
      ) : null}
    </>
  );

  const shellClass = cn(
    "rounded-[var(--mds-radius-md)] border border-border bg-card p-3.5 shadow-[var(--mds-elevation-1)] touch-manipulation",
    (href || onClick) && "transition-shadow active:bg-muted/40",
    className
  );

  return (
    <div className={shellClass}>
      {href ? (
        <Link
          href={href}
          className="block rounded-[var(--mds-radius-sm)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="block w-full rounded-[var(--mds-radius-sm)] text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {footer ? <div className="mt-3 border-t border-border/60 pt-3">{footer}</div> : null}
    </div>
  );
}
