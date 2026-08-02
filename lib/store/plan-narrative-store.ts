"use client"

import { create } from "zustand"

interface PlanNarrativeCache {
  payloadJson: string
  text: string
}

interface PlanNarrativeState {
  text: string
  cache: PlanNarrativeCache | null
  setText: (text: string) => void
  setCache: (cache: PlanNarrativeCache | null) => void
  clear: () => void
}

/**
 * Deliberately not persisted (no zustand `persist` middleware) — the
 * generated narrative should survive navigating between calculator tabs
 * (this store lives at module scope, independent of PlanNarrativeCard's
 * mount lifecycle) but still reset on a full page reload, since it's a
 * cache of AI output, not saved plan data.
 */
export const usePlanNarrativeStore = create<PlanNarrativeState>((set) => ({
  text: "",
  cache: null,
  setText: (text) => set({ text }),
  setCache: (cache) => set({ cache }),
  clear: () => set({ text: "", cache: null }),
}))
