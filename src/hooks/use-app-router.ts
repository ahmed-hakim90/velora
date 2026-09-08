"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRouteTransitionStore } from "@/stores/route-transition-store";
import { useFilterTransitionStore } from "@/stores/filter-transition-store";

/**
 * App Router with instant pending UI. Pathname changes use the page skeleton;
 * same-path query changes keep current content and use filter feedback.
 */
export function useAppRouter() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const filterIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (pending || filterIdRef.current === null) return;
    useFilterTransitionStore.getState().finish(filterIdRef.current);
    filterIdRef.current = null;
  }, [pending]);

  return useMemo(
    () => ({
      ...router,
      push(href: string, options?: Parameters<typeof router.push>[1]) {
        const destination = new URL(href, window.location.origin);
        if (destination.pathname === window.location.pathname) {
          filterIdRef.current = useFilterTransitionStore.getState().start();
          startTransition(() => router.push(href, options));
          return;
        }
        useRouteTransitionStore.getState().start(href);
        router.push(href, options);
      },
      replace(href: string, options?: Parameters<typeof router.replace>[1]) {
        const destination = new URL(href, window.location.origin);
        if (destination.pathname === window.location.pathname) {
          filterIdRef.current = useFilterTransitionStore.getState().start();
          startTransition(() => router.replace(href, options));
          return;
        }
        useRouteTransitionStore.getState().start(href);
        router.replace(href, options);
      },
    }),
    [router, startTransition]
  );
}
