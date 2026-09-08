"use client";

import { create } from "zustand";

const MIN_VISIBLE_MS = 250;

type FilterTransitionState = {
  activeId: number | null;
  startedAt: number | null;
  start: () => number;
  finish: (id: number) => void;
};

let sequence = 0;
let finishTimer: ReturnType<typeof setTimeout> | null = null;

/** Global feedback for filter work without replacing the current page contents. */
export const useFilterTransitionStore = create<FilterTransitionState>((set, get) => ({
  activeId: null,
  startedAt: null,
  start: () => {
    if (finishTimer) clearTimeout(finishTimer);
    const id = ++sequence;
    set({ activeId: id, startedAt: Date.now() });
    return id;
  },
  finish: (id) => {
    const state = get();
    if (state.activeId !== id || state.startedAt === null) return;

    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - state.startedAt));
    finishTimer = setTimeout(() => {
      if (get().activeId === id) set({ activeId: null, startedAt: null });
      finishTimer = null;
    }, remaining);
  },
}));

