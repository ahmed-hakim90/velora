"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";

export type DateRangeValue = { from: string; to: string };

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function recentRange(months: number): DateRangeValue {
  const to = new Date();
  const targetMonth = new Date(to.getFullYear(), to.getMonth() - months, 1, 12);
  const lastTargetDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
    12,
  ).getDate();
  const from = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(to.getDate(), lastTargetDay),
    12,
  );
  return { from: dateInputValue(from), to: dateInputValue(to) };
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const occupiedCells = first.getDay() + last.getDate();
  const cellCount = occupiedCells <= 35 ? 35 : 42;
  return Array.from({ length: cellCount }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatDate(value: string, locale: string) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "—";
}

function MonthCalendar({ month, range, locale, onSelect }: { month: Date; range: DateRangeValue; locale: string; onSelect: (day: Date) => void }) {
  const from = parseDate(range.from);
  const to = parseDate(range.to);
  const weekdayLabels = locale === "ar-EG" ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <section className="min-w-0 flex-1" aria-label={new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}>
      <h3 className="mb-3 text-center text-sm font-semibold">{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}</h3>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {weekdayLabels.map((label, index) => <span key={`${label}-${index}`} className="py-1.5">{label}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays(month).map((day) => {
          const value = dateInputValue(day);
          const isOutside = day.getMonth() !== month.getMonth();
          const isStart = value === range.from;
          const isEnd = value === range.to;
          const isBetween = Boolean(from && to && day > from && day < to);
          const isToday = value === dateInputValue(new Date());
          return (
            <button
              key={value}
              type="button"
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(day)}
              aria-pressed={isStart || isEnd}
              aria-hidden={isOutside}
              disabled={isOutside}
              onClick={() => onSelect(day)}
              className={cn(
                "relative flex size-9 items-center justify-center text-xs outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:size-10",
                isOutside && "invisible",
                isBetween && "bg-primary/15 text-foreground",
                (isStart || isEnd) && "rounded-[var(--mds-radius-sm)] bg-primary font-bold text-primary-foreground",
                !isStart && !isEnd && !isBetween && "rounded-[var(--mds-radius-sm)] hover:bg-muted",
                isToday && !isStart && !isEnd && "font-bold text-primary",
              )}
            >
              {!isOutside && new Intl.NumberFormat(locale, { useGrouping: false }).format(day.getDate())}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function DateRangeFilter({ value, onChange, className }: { value: DateRangeValue; onChange: (value: DateRangeValue) => void; className?: string }) {
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const selectionPrompt =
    draft.from && !draft.to
      ? language === "ar" ? "اختر تاريخ النهاية" : "Select end date"
      : language === "ar" ? "اختر تاريخ البداية" : "Select start date";
  const [visibleMonth, setVisibleMonth] = useState(() => parseDate(value.from) ?? new Date());
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const presets = [
    { label: "All", range: { from: "", to: "" } },
    { label: "One month", range: recentRange(1) },
    { label: "Two months", range: recentRange(2) },
    { label: "Three months", range: recentRange(3) },
  ];

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCalendar();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function closeCalendar() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function keepFocusInside(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("aria-hidden"));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openCalendar() {
    setDraft(value);
    setVisibleMonth(parseDate(value.from) ?? new Date());
    setOpen(true);
    window.setTimeout(() => {
      const dialog = dialogRef.current;
      const preferred =
        dialog?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
        dialog?.querySelector<HTMLElement>("button:not([disabled])");
      (preferred ?? dialog)?.focus();
    }, 0);
  }

  function selectDay(day: Date) {
    const selected = dateInputValue(day);
    if (!draft.from || draft.to) {
      setDraft({ from: selected, to: "" });
      return;
    }
    const completed = selected < draft.from ? { from: selected, to: draft.from } : { from: draft.from, to: selected };
    setDraft(completed);
    onChange(completed);
    closeCalendar();
  }

  function selectPreset(range: DateRangeValue) {
    setDraft(range);
    onChange(range);
    closeCalendar();
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("Choose date range")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openCalendar}
        className="flex min-h-12 w-full min-w-0 items-center gap-3 overflow-hidden rounded-[var(--mds-radius-md)] border border-border bg-card px-3 text-start outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:w-[26rem]"
      >
        <CalendarDays className="size-5 shrink-0 text-muted-foreground" />
        <span dir="ltr" className="min-w-0 truncate text-sm font-medium tabular-nums">
          {formatDate(value.from, locale)} — {formatDate(value.to, locale)}
        </span>
      </button>

      {open && (
        <>
          <button type="button" tabIndex={-1} aria-label={t("Close")} className="fixed inset-0 z-40 cursor-default bg-background/70 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none" onClick={closeCalendar} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("Choose date range")}
            tabIndex={-1}
            onKeyDown={keepFocusInside}
            className="fixed inset-x-3 top-1/2 z-50 max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-[var(--mds-radius-lg)] border border-border bg-popover p-3 text-popover-foreground shadow-2xl outline-none md:inset-x-auto md:left-1/2 md:w-[46rem] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2"
          >
            <div className="grid gap-3 md:grid-cols-[9rem_1fr]">
              <div className="grid grid-cols-2 gap-1.5 border-b border-border pb-3 md:grid-cols-1 md:border-b-0 md:border-e md:pb-0 md:pe-3" aria-label={t("Quick ranges")}>
                {presets.map((preset) => {
                  const active = value.from === preset.range.from && value.to === preset.range.to;
                  return <Button key={preset.label} type="button" aria-pressed={active} variant={active ? "default" : "ghost"} className="min-h-10 justify-start whitespace-normal text-start" onClick={() => selectPreset(preset.range)}>{t(preset.label)}</Button>;
                })}
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between">
                  <Button type="button" variant="ghost" size="icon" aria-label={t("Previous month")} onClick={() => setVisibleMonth((month) => addMonths(month, -1))}><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
                  <p aria-live="polite" className="px-2 text-center text-xs font-medium text-muted-foreground">
                    {selectionPrompt}
                  </p>
                  <Button type="button" variant="ghost" size="icon" aria-label={t("Next month")} onClick={() => setVisibleMonth((month) => addMonths(month, 1))}><ChevronRight className="size-4 rtl:rotate-180" /></Button>
                </div>
                <div className="flex gap-5">
                  <MonthCalendar month={visibleMonth} range={draft} locale={locale} onSelect={selectDay} />
                  <div className="hidden min-w-0 flex-1 md:block"><MonthCalendar month={addMonths(visibleMonth, 1)} range={draft} locale={locale} onSelect={selectDay} /></div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <Button type="button" variant="ghost" onClick={() => selectPreset({ from: "", to: "" })}>{t("Clear")}</Button>
                  <Button type="button" variant="ghost" onClick={() => { const today = dateInputValue(new Date()); selectPreset({ from: today, to: today }); }}>{t("Today")}</Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
