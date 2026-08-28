import { cn } from "@/lib/utils";
import { GlassPanel } from "./glass-panel";
import { LocalizedText } from "@/components/Velora/localized-text";

interface KpiCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export function KpiCard({ label, value, change, trend, icon, className }: KpiCardProps) {
  return (
    <GlassPanel
      variant="elevated"
      className={cn(
        "overflow-hidden p-0 transition-shadow hover:shadow-[var(--mds-elevation-2)]",
        className
      )}
    >
      <div className="h-1 w-full bg-[var(--mds-color-action-primary)]" aria-hidden />
      <div className="flex min-w-0 items-start justify-between gap-2 p-2.5 sm:gap-3 sm:p-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground"><LocalizedText text={label} /></p>
          <p className="mt-0.5 break-words text-lg font-semibold tracking-tight tabular-nums text-foreground sm:text-2xl">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                trend === "up" && "text-[var(--mds-color-feedback-success)]",
                trend === "down" && "text-[var(--mds-color-feedback-danger)]",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              <LocalizedText text={change} />
            </p>
          )}
        </div>
        {icon && (
          <div className="hidden size-8 shrink-0 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-harbor-50)] text-[var(--mds-color-action-primary)] min-[360px]:flex">
            {icon}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
