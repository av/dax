/**
 * Deferred physics command queue.
 *
 * Async code (e.g. IPC callbacks after a file move) must never mutate Rapier
 * rigid bodies directly — doing so risks overlapping with the useFrame loop
 * and triggers Rust aliasing violations in the WASM runtime.
 *
 * Instead, async code pushes commands here. FileInstances drains and applies
 * them at the top of its useFrame callback, where all body access is serialized.
 *
 * Module-level mutable ref (same pattern as physicsPositionsRef) — zero re-renders.
 */

// ── Types ──────────────────────────────────────────────

type PhysicsCommand =
  | { type: 'restore'; id: string }
  | { type: 'snapBack'; id: string; position: [number, number, number] };

// ── Queue ──────────────────────────────────────────────

const queue: PhysicsCommand[] = [];

export function enqueueRestore(id: string): void {
  queue.push({ type: 'restore', id });
}

export function enqueueSnapBack(id: string, position: [number, number, number]): void {
  queue.push({ type: 'snapBack', id, position });
}

/** Drain all pending commands. Returns them and clears the queue. */
export function drainPhysicsCommands(): PhysicsCommand[] {
  if (queue.length === 0) return queue;
  return queue.splice(0);
}
