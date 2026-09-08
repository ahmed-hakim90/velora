import { afterEach, describe, expect, it, vi } from "vitest";
import { useFilterTransitionStore } from "@/stores/filter-transition-store";

describe("filter transition feedback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays visible for at least 250ms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const id = useFilterTransitionStore.getState().start();

    useFilterTransitionStore.getState().finish(id);
    vi.advanceTimersByTime(249);
    expect(useFilterTransitionStore.getState().activeId).toBe(id);

    vi.advanceTimersByTime(1);
    expect(useFilterTransitionStore.getState().activeId).toBeNull();
  });

  it("ignores completion from an older filter request", () => {
    vi.useFakeTimers();
    const first = useFilterTransitionStore.getState().start();
    const latest = useFilterTransitionStore.getState().start();

    useFilterTransitionStore.getState().finish(first);
    vi.advanceTimersByTime(500);
    expect(useFilterTransitionStore.getState().activeId).toBe(latest);

    useFilterTransitionStore.getState().finish(latest);
    vi.advanceTimersByTime(250);
    expect(useFilterTransitionStore.getState().activeId).toBeNull();
  });
});

