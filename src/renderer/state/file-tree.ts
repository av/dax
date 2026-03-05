/**
 * File tree signal store.
 * Reactive store for the file/folder tree structure.
 */
import { createStore } from 'solid-js/store';
import type { FileEntry } from '@shared/file-types';

export interface FileTreeState {
  /** All files and folders in the workspace */
  entries: FileEntry[];
  /** Whether the tree is currently loading */
  loading: boolean;
  /** Error message if tree loading failed */
  error: string | null;
}

const [fileTree, setFileTree] = createStore<FileTreeState>({
  entries: [],
  loading: false,
  error: null,
});

export { fileTree, setFileTree };

/** Add an entry to the file tree. */
export function addEntry(entry: FileEntry): void {
  setFileTree('entries', (prev) => [...prev, entry]);
}

/** Remove an entry by path. */
export function removeEntry(path: string): void {
  setFileTree('entries', (prev) => prev.filter((e) => e.path !== path));
}

/** Update an entry (e.g., after rename). */
export function updateEntry(path: string, updates: Partial<FileEntry>): void {
  setFileTree('entries', (e) => e.path === path, updates);
}

/** Replace the entire file tree. */
export function replaceTree(entries: FileEntry[]): void {
  setFileTree({ entries, loading: false, error: null });
}
