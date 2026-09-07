import {
  BadgeDollarSign,
  Ban,
  Clock3,
  Percent,
  ReceiptText,
  Truck,
  WalletCards,
} from "lucide-react";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SessionActivityEvent } from "@/modules/sessions/lib/session-activity";

function formatActivityTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  });
}

function EventIcon({ event }: { event: SessionActivityEvent }) {
  const Icon = event.kind.startsWith("supplier_payment")
    ? Truck
    : event.kind.startsWith("expense")
      ? WalletCards
      : event.kind.startsWith("sale")
        ? event.kind === "sale"
          ? ReceiptText
          : Ban
        : Clock3;
  return <Icon className="size-4" aria-hidden />;
}

export function SessionActivityTimeline({ events }: { events: SessionActivityEvent[] }) {
  if (events.length === 0) {
    return <EmptyStateBlock title="مفيش نشاط مسجل" description="أي حركة تحصل داخل الجلسة هتظهر هنا." />;
  }

  return (
    <OperationalCard
      title="سجل حركة الجلسة"
      description="المبيعات والخصومات والمصروفات ودفعات الموردين مرتبة زمنيًا"
    >
      <ol className="relative space-y-1 before:absolute before:bottom-4 before:start-[1.15rem] before:top-4 before:w-px before:bg-border">
        {events.map((event) => (
          <li key={event.id} className="relative flex gap-3 rounded-lg px-1 py-3 sm:px-2">
            <span
              className={cn(
                "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-background",
                event.tone === "positive" && "border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300",
                event.tone === "negative" && "border-red-300 text-red-700 dark:border-red-500/40 dark:text-red-300",
                event.tone === "warning" && "border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300"
              )}
            >
              <EventIcon event={event} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div>
                  <p className="font-medium text-foreground">{event.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatActivityTime(event.occurredAt)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </div>
                {event.amount != null ? (
                  <span className="font-semibold tabular-nums">{formatCurrency(event.amount)}</span>
                ) : null}
              </div>
              {event.description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.description}</p>
              ) : null}
              {event.discount > 0 ? (
                <Badge variant="outline" className="mt-2 gap-1 border-amber-300 text-amber-800 dark:border-amber-500/40 dark:text-amber-200">
                  <Percent className="size-3" aria-hidden />
                  إجمالي الخصم {formatCurrency(event.discount)}
                </Badge>
              ) : event.kind === "sale" ? (
                <Badge variant="outline" className="mt-2 gap-1">
                  <BadgeDollarSign className="size-3" aria-hidden />
                  بدون خصم
                </Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </OperationalCard>
  );
}
