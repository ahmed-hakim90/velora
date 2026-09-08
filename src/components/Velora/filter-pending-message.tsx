"use client";

import { LoaderCircle } from "lucide-react";
import { useFilterTransitionStore } from "@/stores/filter-transition-store";
import { cn } from "@/lib/utils";
import { LocalizedText } from "@/components/Velora/localized-text";

export function FilterPendingMessage({ className }: { className?: string }) {
  const pending = useFilterTransitionStore((state) => state.activeId !== null);

  return (
    <p
      className={cn(
        "flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-[var(--mds-motion-fast)]",
        pending ? "opacity-100" : "opacity-0",
        className
      )}
      aria-hidden="true"
    >
      <LoaderCircle className={cn("size-3.5", pending && "animate-spin motion-reduce:animate-none")} />
      <LocalizedText text="Updating results..." />
    </p>
  );
}
