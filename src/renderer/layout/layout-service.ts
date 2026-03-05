/**
 * Layout service — manages the d3-force Web Worker.
 *
 * Responsibilities:
 * - Post graph data (nodes + links) to the layout worker
 * - Receive computed positions back
 * - Handle incremental updates (new files positioned without moving pinned objects)
 * - "Reset Layout" clears all pins and re-runs full simulation
 * - Animated transitions when layout recalculates (objects glide to new positions)
 */
import type { FileEntry } from '@shared/file-types';
import type { SceneObjectRow } from '../db/types';

// Re-export worker types for use by consumers
export interface LayoutNode {
  id: string;
  parentId: string | null;
  type: 'file' | 'folder';
  isPinned: boolean;
  radius: number;
  x?: number;
  y?: number;
}

export interface LayoutLink {
  source: string;
  target: string;
}

export interface LayoutRequest {
  type: 'full' | 'incremental';
  nodes: LayoutNode[];
  links: LayoutLink[];
}

export interface LayoutResult {
  type: 'positions';
  nodes: Array<{
    id: string;
    x: number;
    y: number;
  }>;
  elapsed: number;
}

export interface LayoutProgress {
  type: 'progress';
  alpha: number;
  tickCount: number;
}

export type LayoutCallback = (positions: Map<string, { x: number; z: number }>) => void;
export type LayoutProgressCallback = (alpha: number, tickCount: number) => void;

/** Collision radii for different object types */
const FILE_RADIUS = 1.0;
const FOLDER_RADIUS = 1.5;

let worker: Worker | null = null;
let pendingCallback: LayoutCallback | null = null;
let progressCallback: LayoutProgressCallback | null = null;

/**
 * Initialize the layout worker.
 * Must be called before using any layout functions.
 */
export function initLayoutWorker(): void {
  if (worker) return;

  worker = new Worker(
    new URL('./layout.worker.ts', import.meta.url),
    { type: 'module' },
  );

  worker.onmessage = (event: MessageEvent<LayoutResult | LayoutProgress>) => {
    const data = event.data;

    if (data.type === 'progress') {
      progressCallback?.(data.alpha, data.tickCount);
      return;
    }

    if (data.type === 'positions') {
      // Convert d3's XY to our scene's XZ (d3 uses 2D x,y → we map to 3D x,z)
      const positions = new Map<string, { x: number; z: number }>();
      for (const node of data.nodes) {
        positions.set(node.id, { x: node.x, z: node.y });
      }
      pendingCallback?.(positions);
      pendingCallback = null;
    }
  };

  worker.onerror = (err) => {
    console.error('[layout-service] Worker error:', err);
  };
}

/**
 * Dispose the layout worker.
 */
export function disposeLayoutWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pendingCallback = null;
  progressCallback = null;
}

/**
 * Set a callback for layout progress updates.
 */
export function onLayoutProgress(callback: LayoutProgressCallback): void {
  progressCallback = callback;
}

/**
 * Build the node and link arrays from file entries and scene objects.
 */
export function buildLayoutGraph(
  entries: FileEntry[],
  sceneObjects: Record<string, SceneObjectRow>,
): { nodes: LayoutNode[]; links: LayoutLink[] } {
  const nodes: LayoutNode[] = [];
  const links: LayoutLink[] = [];

  for (const entry of entries) {
    const existing = sceneObjects[entry.path];
    const node: LayoutNode = {
      id: entry.path,
      parentId: entry.parentPath,
      type: entry.type,
      isPinned: existing?.isPinned ?? false,
      radius: entry.type === 'folder' ? FOLDER_RADIUS : FILE_RADIUS,
      // Use existing positions if available (so d3 starts from current state)
      x: existing?.positionX,
      y: existing?.positionZ,  // Map positionZ to d3's y
    };
    nodes.push(node);

    // Create link from child to parent
    if (entry.parentPath) {
      links.push({
        source: entry.parentPath,
        target: entry.path,
      });
    }
  }

  return { nodes, links };
}

/**
 * Run a full d3-force layout.
 * Computes positions for ALL nodes (pinned ones stay fixed).
 *
 * @param entries - All file/folder entries
 * @param sceneObjects - Current scene object state (for positions and pin state)
 * @returns Promise that resolves with a map of path → { x, z } positions
 */
export function runFullLayout(
  entries: FileEntry[],
  sceneObjects: Record<string, SceneObjectRow>,
): Promise<Map<string, { x: number; z: number }>> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('Layout worker not initialized. Call initLayoutWorker() first.'));
      return;
    }

    const { nodes, links } = buildLayoutGraph(entries, sceneObjects);

    pendingCallback = resolve;

    const request: LayoutRequest = {
      type: 'full',
      nodes,
      links,
    };

    worker.postMessage(request);
  });
}

/**
 * Run an incremental layout for newly added entries.
 * Pins existing objects at their current positions and only positions new ones.
 *
 * @param entries - ALL entries (including both existing and new)
 * @param sceneObjects - Current scene objects (new ones won't be in here yet)
 * @param newPaths - Set of paths that are new (need positioning)
 * @returns Promise with position map
 */
export function runIncrementalLayout(
  entries: FileEntry[],
  sceneObjects: Record<string, SceneObjectRow>,
  newPaths: Set<string>,
): Promise<Map<string, { x: number; z: number }>> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('Layout worker not initialized. Call initLayoutWorker() first.'));
      return;
    }

    const { nodes, links } = buildLayoutGraph(entries, sceneObjects);

    // Pin all existing nodes (not just user-pinned ones) for incremental layout
    for (const node of nodes) {
      if (!newPaths.has(node.id) && node.x != null && node.y != null) {
        node.isPinned = true;
      }
    }

    pendingCallback = resolve;

    const request: LayoutRequest = {
      type: 'incremental',
      nodes,
      links,
    };

    worker.postMessage(request);
  });
}

/**
 * Clear all pins before re-running full layout (for "Reset Layout" command).
 * Returns a set of all paths that were unpinned.
 */
export function clearAllPins(
  sceneObjects: Record<string, SceneObjectRow>,
): Set<string> {
  const unpinned = new Set<string>();
  for (const [path, obj] of Object.entries(sceneObjects)) {
    if (obj.isPinned) {
      unpinned.add(path);
    }
  }
  return unpinned;
}
