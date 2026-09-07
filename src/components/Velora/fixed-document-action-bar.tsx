"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Fixed document actions with a live-sized spacer so wrapped actions never
 * cover the final rows of the document.
 */
export function FixedDocumentActionBar({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const updateHeight = () => setHeight(Math.ceil(bar.getBoundingClientRect().height));
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden data-document-action-spacer style={{ height }} />
      <div
        ref={barRef}
        data-document-action-bar
        className={cn(
          "fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-xl",
          "lg:bottom-0 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:ps-64 lg:pt-3",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </>
  );
}
