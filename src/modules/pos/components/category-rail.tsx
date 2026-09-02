"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

interface CategoryRailProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryRail({
  categories,
  selectedId,
  onSelect,
}: CategoryRailProps) {
  const { t } = useTranslation();
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedKey = selectedId ?? "all";

  useEffect(() => {
    const selectedButton = buttonRefs.current.get(selectedKey);
    if (!selectedButton) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    selectedButton.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedKey]);

  function registerButton(key: string, node: HTMLButtonElement | null) {
    if (node) buttonRefs.current.set(key, node);
    else buttonRefs.current.delete(key);
  }

  if (categories.length === 0) return null;

  return (
    <div
      className="flex h-12 touch-pan-x gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-border/70 bg-card/85 p-0.5 scroll-px-0.5 scroll-ps-14 snap-x snap-proximity [-webkit-overflow-scrolling:touch] scrollbar-none dark:bg-card/95"
      role="group"
      aria-label={t("Product categories")}
    >
      <button
        ref={(node) => registerButton("all", node)}
        type="button"
        aria-pressed={selectedId === null}
        onClick={() => onSelect(null)}
        className={cn(
          "sticky start-0 z-10 h-11 shrink-0 snap-start rounded-md px-2.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:px-3 sm:text-sm",
          selectedId === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-card text-foreground/80 shadow-sm hover:bg-muted hover:text-foreground dark:text-foreground/85 dark:hover:bg-muted/70",
        )}
      >
        {t("All")}
      </button>
      {categories.map((cat) => (
        <button
          ref={(node) => registerButton(cat.id, node)}
          key={cat.id}
          type="button"
          aria-pressed={selectedId === cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            "flex h-11 shrink-0 snap-start items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:px-2.5 sm:text-sm",
            selectedId === cat.id
              ? "bg-primary font-semibold text-primary-foreground shadow-sm"
              : "text-foreground/75 hover:bg-muted hover:text-foreground dark:text-foreground/80 dark:hover:bg-muted/70",
          )}
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full ring-1 ring-black/10",
              selectedId === cat.id && "ring-white/50",
            )}
            style={{ backgroundColor: cat.color }}
            aria-hidden
          />
          <span className="max-w-28 truncate sm:max-w-36">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
