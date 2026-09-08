"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFilterTransitionStore } from "@/stores/filter-transition-store";

interface UseFilterTransitionOptions<T extends object> {
  value: T;
  onApply: (value: T) => void;
  debounceMs?: number;
}

/**
 * Keeps filter controls optimistic while a local or URL-backed update is running.
 * `applyDebounced` is intended for text search; selects and dates should use `apply`.
 */
export function useFilterTransition<T extends object>({
  value,
  onApply,
  debounceMs = 300,
}: UseFilterTransitionOptions<T>) {
  const [optimisticValue, setOptimisticValue] = useState(value);
  const optimisticRef = useRef(value);
  const [transitionPending, startTransition] = useTransition();
  const activeIdRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    (patch: Partial<T>) => {
      const next = { ...optimisticRef.current, ...patch };
      optimisticRef.current = next;
      setOptimisticValue(next);
      const id = useFilterTransitionStore.getState().start();
      activeIdRef.current = id;
      startTransition(() => {
        onApply(next);
      });
    },
    [onApply]
  );

  const apply = useCallback(
    (patch: Partial<T>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      run(patch);
    },
    [run]
  );

  const applyDebounced = useCallback(
    (patch: Partial<T>) => {
      const next = { ...optimisticRef.current, ...patch };
      optimisticRef.current = next;
      setOptimisticValue(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        run(patch);
      }, debounceMs);
    },
    [debounceMs, run]
  );

  useEffect(() => {
    if (transitionPending || debounceRef.current) return;
    optimisticRef.current = value;
    setOptimisticValue(value);
  }, [transitionPending, value]);

  useEffect(() => {
    if (transitionPending || activeIdRef.current === null) return;
    useFilterTransitionStore.getState().finish(activeIdRef.current);
    activeIdRef.current = null;
  }, [transitionPending]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (activeIdRef.current !== null) {
        useFilterTransitionStore.getState().finish(activeIdRef.current);
      }
    },
    []
  );

  return {
    filters: optimisticValue,
    applyFilters: apply,
    applyFiltersDebounced: applyDebounced,
    isPending: transitionPending,
  };
}
