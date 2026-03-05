/**
 * Selection signal.
 * Tracks the currently selected object IDs (paths) in the 3D scene.
 */
import { createSignal } from 'solid-js';

const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());

export { selectedIds, setSelectedIds };

/** Select a single object (deselects all others). */
export function selectOne(id: string): void {
  setSelectedIds(new Set([id]));
}

/** Add an object to the selection (multi-select). */
export function addToSelection(id: string): void {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    next.add(id);
    return next;
  });
}

/** Remove an object from the selection. */
export function removeFromSelection(id: string): void {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
}

/** Toggle an object in the selection. */
export function toggleSelection(id: string): void {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
}

/** Clear the selection entirely. */
export function clearSelection(): void {
  setSelectedIds(new Set<string>());
}

/** Check if an object is selected. */
export function isSelected(id: string): boolean {
  return selectedIds().has(id);
}
