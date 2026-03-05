/**
 * Belief definitions and update logic.
 *
 * Beliefs represent the agent's understanding of the workspace state.
 * They are updated each BDI cycle from the actual file tree and scene state.
 */
import { fileTree } from '../state/file-tree';
import type { FileEntry } from '@shared/file-types';

/** All belief keys the agent tracks */
export interface AgentBeliefs {
  /** Total number of files in the workspace */
  file_count: number;
  /** Total number of folders */
  folder_count: number;
  /** Maximum folder nesting depth */
  folder_depth: number;
  /** Paths of the N most recently modified files */
  last_modified_files: string[];
  /** Clutter level (0 = pristine, 1 = extremely cluttered) */
  clutter_level: number;
  /** Number of files at the root level without a folder */
  root_loose_files: number;
  /** Workspace root path */
  workspace_path: string;
  /** Map of file category → count */
  category_counts: Record<string, number>;
  /** Timestamp of last belief update */
  last_updated: number;
}

/** Default initial beliefs */
export function createInitialBeliefs(): AgentBeliefs {
  return {
    file_count: 0,
    folder_count: 0,
    folder_depth: 0,
    last_modified_files: [],
    clutter_level: 0,
    root_loose_files: 0,
    workspace_path: '',
    category_counts: {},
    last_updated: Date.now(),
  };
}

/**
 * Compute the maximum nesting depth from entries.
 */
function computeDepth(entries: FileEntry[]): number {
  let maxDepth = 0;
  for (const entry of entries) {
    const depth = entry.path.split('/').length - 1;
    if (depth > maxDepth) maxDepth = depth;
  }
  return maxDepth;
}

/**
 * Compute a clutter level from 0-1 based on workspace characteristics.
 *
 * Clutter heuristics:
 * - Many loose files at root (no parent folder): increases clutter
 * - Very flat structure (low depth, many files): increases clutter
 * - High file-to-folder ratio: increases clutter
 */
function computeClutterLevel(entries: FileEntry[]): number {
  if (entries.length === 0) return 0;

  const files = entries.filter((e) => e.type === 'file');
  const folders = entries.filter((e) => e.type === 'folder');

  // Root loose files: files whose parentPath is null or the root
  const rootLoose = files.filter(
    (f) => !f.parentPath || !f.parentPath.includes('/'),
  ).length;

  // Factor 1: ratio of root-level loose files to total files (0-1)
  const looseRatio = files.length > 0 ? rootLoose / files.length : 0;

  // Factor 2: file-to-folder ratio (high = cluttered)
  const fileToFolderRatio =
    folders.length > 0
      ? Math.min(files.length / (folders.length * 5), 1) // normalize: 5 files per folder = max
      : files.length > 5
        ? 1
        : 0;

  // Factor 3: flat structure penalty
  const depth = computeDepth(entries);
  const flatPenalty = entries.length > 20 && depth < 2 ? 0.3 : 0;

  // Weighted average
  const clutter = looseRatio * 0.4 + fileToFolderRatio * 0.3 + flatPenalty * 0.3;
  return Math.min(Math.max(clutter, 0), 1);
}

/**
 * Count files by category.
 */
function countCategories(entries: FileEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.type === 'file') {
      const cat = entry.category ?? 'unknown';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Root-level loose file count.
 */
function countRootLooseFiles(entries: FileEntry[]): number {
  return entries.filter(
    (e) => e.type === 'file' && (!e.parentPath || !e.parentPath.includes('/')),
  ).length;
}

/**
 * Update beliefs from the current file tree state.
 * Returns a new AgentBeliefs object reflecting the current workspace.
 */
export function updateBeliefs(workspacePath: string): AgentBeliefs {
  const entries = fileTree.entries;
  const files = entries.filter((e) => e.type === 'file');
  const folders = entries.filter((e) => e.type === 'folder');

  return {
    file_count: files.length,
    folder_count: folders.length,
    folder_depth: computeDepth(entries),
    last_modified_files: files.slice(0, 10).map((f) => f.path),
    clutter_level: computeClutterLevel(entries),
    root_loose_files: countRootLooseFiles(entries),
    workspace_path: workspacePath,
    category_counts: countCategories(entries),
    last_updated: Date.now(),
  };
}

/**
 * Serialize beliefs to JSON for DB storage.
 */
export function serializeBeliefs(beliefs: AgentBeliefs): string {
  return JSON.stringify(beliefs);
}

/**
 * Deserialize beliefs from a JSON string.
 */
export function deserializeBeliefs(json: string): AgentBeliefs {
  try {
    return JSON.parse(json) as AgentBeliefs;
  } catch {
    return createInitialBeliefs();
  }
}
