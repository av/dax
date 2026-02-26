/**
 * Module-level mutable reference to the latest physics body world positions.
 * Written by FileInstances every ~30 frames; read by saveScene at shutdown.
 * Plain object (not Zustand state) — zero re-renders.
 */
export const physicsPositionsRef: { current: Map<string, [number, number, number]> } = {
  current: new Map(),
};
