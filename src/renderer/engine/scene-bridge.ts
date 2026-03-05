/**
 * Scene bridge — syncs file-tree signal state to the Babylon.js scene graph.
 *
 * Uses Solid.js createEffect watchers to reactively:
 * - Create meshes when new entries appear in the file tree
 * - Remove meshes when entries are deleted
 * - Animate changes (fadeIn, dissolve, pulse, renameFlash)
 * - Persist scene objects to DB
 *
 * Also handles:
 * - Initial scene population from scanned entries
 * - Layout computation (d3-force via Web Worker for M6)
 * - Animated layout transitions (objects glide to new positions)
 * - Batched mesh creation via requestAnimationFrame for large directories
 */
import { Vector3, Animation, CubicEase, EasingFunction } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { createMeshForEntry, getMeshByPath, disposeMeshByPath, renameMesh, updateMeshLabel } from './mesh-factory';
import { fadeIn, dissolve, pulse, renameFlash } from './animations';
import { getFileCategory } from '@shared/file-types';
import type { FileEntry } from '@shared/file-types';
import type { FSEvent, FSEventBatch } from '@shared/events';
import type { SceneObjectRow } from '../db/types';
import { LAYOUT_TRANSITION_MS } from '@shared/constants';
import {
  initLayoutWorker,
  runFullLayout,
  runIncrementalLayout,
  clearAllPins,
} from '../layout/layout-service';

/** Grid layout settings */
const GRID_SPACING = 3.0;
const GRID_COLS = 20;
const GRID_START_X = -((GRID_COLS - 1) * GRID_SPACING) / 2;
const GRID_START_Z = -5;

/** Batch size for mesh creation per animation frame */
const BATCH_SIZE = 50;

/**
 * Compute a grid position for an entry based on its index.
 */
function gridPosition(index: number): Vector3 {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return new Vector3(
    GRID_START_X + col * GRID_SPACING,
    0,
    GRID_START_Z - row * GRID_SPACING,
  );
}

/**
 * Create a SceneObjectRow from a FileEntry and position.
 */
function entryToSceneObjectRow(entry: FileEntry, position: Vector3, index: number): SceneObjectRow {
  return {
    id: generateId(),
    path: entry.path,
    parentPath: entry.parentPath,
    type: entry.type,
    positionX: position.x,
    positionY: position.y,
    positionZ: position.z,
    isPinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Generate a simple unique ID (UUIDv4-ish for now).
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SceneBridgeCallbacks {
  /** Persist scene objects to DB */
  persistBatch: (objs: SceneObjectRow[]) => Promise<void>;
  /** Delete a scene object from DB */
  persistDelete: (path: string) => Promise<void>;
  /** Get all persisted scene objects */
  loadPersistedObjects: () => Promise<SceneObjectRow[]>;
}

/**
 * Populate the scene with entries from a directory scan.
 * Creates meshes in batches (BATCH_SIZE per requestAnimationFrame) to avoid blocking.
 * Then runs d3-force layout to compute optimal positions.
 *
 * @param entries - FileEntry[] from the scanner
 * @param scene - Babylon.js Scene
 * @param callbacks - DB persistence callbacks
 * @param existingObjects - Already persisted scene objects (for position reuse)
 * @returns Promise that resolves when all meshes are created
 */
export async function populateScene(
  entries: FileEntry[],
  scene: Scene,
  callbacks: SceneBridgeCallbacks,
  existingObjects: SceneObjectRow[] = [],
): Promise<SceneObjectRow[]> {
  // Initialize layout worker
  initLayoutWorker();

  // Build a map of existing objects for position reuse
  const existingMap = new Map<string, SceneObjectRow>();
  for (const obj of existingObjects) {
    existingMap.set(obj.path, obj);
  }

  const sceneObjects: SceneObjectRow[] = [];

  // Phase 1: Create meshes (at existing or temporary grid positions)
  await new Promise<void>((resolve) => {
    let index = 0;

    function processBatch(): void {
      const batchEnd = Math.min(index + BATCH_SIZE, entries.length);

      for (; index < batchEnd; index++) {
        const entry = entries[index];
        const existing = existingMap.get(entry.path);

        let position: Vector3;
        if (existing) {
          // Reuse persisted position
          position = new Vector3(existing.positionX, existing.positionY, existing.positionZ);
        } else {
          // Temporary grid position — will be overridden by layout
          position = gridPosition(index);
        }

        const mesh = createMeshForEntry(entry, scene, position);
        fadeIn(mesh as unknown as import('@babylonjs/core').AbstractMesh, scene);

        const row = existing ?? entryToSceneObjectRow(entry, position, index);
        sceneObjects.push(row);
      }

      if (index < entries.length) {
        requestAnimationFrame(processBatch);
      } else {
        resolve();
      }
    }

    if (entries.length > 0) {
      processBatch();
    } else {
      resolve();
    }
  });

  // Phase 2: Run d3-force layout
  // Only run if there are entries without persisted positions
  const hasNewEntries = entries.some((e) => !existingMap.has(e.path));
  const hasAnyPersistedPositions = existingObjects.length > 0;

  if (entries.length > 0 && (!hasAnyPersistedPositions || hasNewEntries)) {
    try {
      const objectMap: Record<string, SceneObjectRow> = {};
      for (const obj of sceneObjects) {
        objectMap[obj.path] = obj;
      }

      const positions = await runFullLayout(entries, objectMap);

      // Apply layout positions with animation
      const updatedObjects: SceneObjectRow[] = [];
      for (const obj of sceneObjects) {
        const layoutPos = positions.get(obj.path);
        if (layoutPos && !obj.isPinned) {
          // Animate mesh to new position
          const node = getMeshByPath(obj.path);
          if (node) {
            animateToPosition(node, layoutPos.x, layoutPos.z, scene);
          }

          // Update scene object row
          obj.positionX = layoutPos.x;
          obj.positionZ = layoutPos.z;
          obj.updatedAt = Date.now();
          updatedObjects.push(obj);
        }
      }

      // Persist updated positions
      if (updatedObjects.length > 0) {
        callbacks.persistBatch(updatedObjects).catch(console.error);
      }
    } catch (err) {
      console.error('[scene-bridge] Layout failed, using grid positions:', err);
    }
  }

  // Persist any new objects that haven't been persisted yet
  const newObjects = sceneObjects.filter((o) => !existingMap.has(o.path));
  if (newObjects.length > 0) {
    callbacks.persistBatch(newObjects).catch(console.error);
  }

  return sceneObjects;
}

/**
 * Animate a mesh node to glide smoothly to a new XZ position.
 * Y position stays the same (determined by physics).
 */
function animateToPosition(
  node: import('@babylonjs/core').TransformNode,
  targetX: number,
  targetZ: number,
  scene: Scene,
): void {
  const frames = Math.round((LAYOUT_TRANSITION_MS / 1000) * 60); // Convert ms to frames at 60fps
  const ease = new CubicEase();
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

  const xAnim = new Animation(
    'layoutMoveX', 'position.x', 60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  xAnim.setKeys([
    { frame: 0, value: node.position.x },
    { frame: frames, value: targetX },
  ]);
  xAnim.setEasingFunction(ease);

  const zAnim = new Animation(
    'layoutMoveZ', 'position.z', 60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  zAnim.setKeys([
    { frame: 0, value: node.position.z },
    { frame: frames, value: targetZ },
  ]);
  zAnim.setEasingFunction(ease);

  scene.beginDirectAnimation(node, [xAnim, zAnim], 0, frames, false);
}

/**
 * Run a full layout reset: clear all pins and recompute positions for everything.
 */
export async function resetLayout(
  entries: FileEntry[],
  sceneObjects: Record<string, SceneObjectRow>,
  scene: Scene,
  callbacks: SceneBridgeCallbacks,
): Promise<void> {
  // Clear all pins
  const unpinned = clearAllPins(sceneObjects);

  // Create unpinned copy of scene objects
  const unpinnedObjects: Record<string, SceneObjectRow> = {};
  for (const [path, obj] of Object.entries(sceneObjects)) {
    unpinnedObjects[path] = { ...obj, isPinned: false };
  }

  // Run full layout
  const positions = await runFullLayout(entries, unpinnedObjects);

  // Apply positions with animation
  const updatedObjects: SceneObjectRow[] = [];
  for (const [path, pos] of positions) {
    const node = getMeshByPath(path);
    if (node) {
      animateToPosition(node, pos.x, pos.z, scene);
    }

    const obj = sceneObjects[path];
    if (obj) {
      const updated: SceneObjectRow = {
        ...obj,
        positionX: pos.x,
        positionZ: pos.z,
        isPinned: false,
        updatedAt: Date.now(),
      };
      updatedObjects.push(updated);
    }
  }

  // Persist
  if (updatedObjects.length > 0) {
    callbacks.persistBatch(updatedObjects).catch(console.error);
  }
}

/**
 * Handle a batch of filesystem events.
 * Creates, removes, or updates meshes based on event types.
 */
export function handleFSEventBatch(
  batch: FSEventBatch,
  scene: Scene,
  callbacks: SceneBridgeCallbacks,
  getCurrentEntries: () => FileEntry[],
): void {
  for (const event of batch.events) {
    handleFSEvent(event, scene, callbacks, getCurrentEntries);
  }
}

/**
 * Handle a single filesystem event.
 */
function handleFSEvent(
  event: FSEvent,
  scene: Scene,
  callbacks: SceneBridgeCallbacks,
  getCurrentEntries: () => FileEntry[],
): void {
  switch (event.type) {
    case 'add':
    case 'addDir': {
      // Check if mesh already exists (avoid duplicates)
      if (getMeshByPath(event.path)) return;

      const isFolder = event.type === 'addDir';
      const ext = isFolder ? '' : (event.path.split('.').pop() ?? '');
      const name = event.path.split('/').pop() ?? event.path;
      const parentPath = event.path.includes('/')
        ? event.path.slice(0, event.path.lastIndexOf('/'))
        : null;

      const entry: FileEntry = {
        path: event.path,
        name,
        extension: isFolder ? '' : ext,
        type: isFolder ? 'folder' : 'file',
        category: isFolder ? 'unknown' : getFileCategory(ext),
        parentPath,
      };

      // Check for rename (renameFrom is set)
      if (event.renameFrom) {
        // This is the "add" side of a rename — update the existing mesh
        const existingMesh = getMeshByPath(event.renameFrom);
        if (existingMesh) {
          renameMesh(event.renameFrom, event.path);
          updateMeshLabel(event.path, name, scene);
          renameFlash(
            existingMesh as unknown as import('@babylonjs/core').AbstractMesh,
            scene,
          );
          // Update DB: delete old, create new
          callbacks.persistDelete(event.renameFrom).catch(console.error);
          const currentEntries = getCurrentEntries();
          const pos = gridPosition(currentEntries.length);
          const row = entryToSceneObjectRow(entry, pos, currentEntries.length);
          callbacks.persistBatch([row]).catch(console.error);
          return;
        }
      }

      // New file/folder — create mesh at temporary grid position
      const currentEntries = getCurrentEntries();
      const pos = gridPosition(currentEntries.length);
      const mesh = createMeshForEntry(entry, scene, pos);
      fadeIn(mesh as unknown as import('@babylonjs/core').AbstractMesh, scene);

      // Persist with grid position initially
      const row = entryToSceneObjectRow(entry, pos, currentEntries.length);
      callbacks.persistBatch([row]).catch(console.error);

      // Run incremental layout asynchronously to position the new object correctly
      runIncrementalLayoutForNewEntry(entry, currentEntries, scene, callbacks);
      break;
    }

    case 'unlink':
    case 'unlinkDir': {
      const mesh = getMeshByPath(event.path);
      if (mesh) {
        dissolve(
          mesh as unknown as import('@babylonjs/core').AbstractMesh,
          scene,
          () => {
            disposeMeshByPath(event.path);
          },
        );
      }
      // Remove from DB
      callbacks.persistDelete(event.path).catch(console.error);
      break;
    }

    case 'change': {
      const mesh = getMeshByPath(event.path);
      if (mesh) {
        pulse(
          mesh as unknown as import('@babylonjs/core').AbstractMesh,
          scene,
        );
      }
      break;
    }
  }
}

/**
 * Run incremental d3-force layout when a single new entry is added.
 * Pins existing nodes at current positions, only positions the new node.
 */
async function runIncrementalLayoutForNewEntry(
  newEntry: FileEntry,
  allEntries: FileEntry[],
  scene: Scene,
  callbacks: SceneBridgeCallbacks,
): Promise<void> {
  try {
    // Build a map of current scene objects from existing meshes
    const sceneObjects: Record<string, SceneObjectRow> = {};
    for (const entry of allEntries) {
      const node = getMeshByPath(entry.path);
      if (node) {
        sceneObjects[entry.path] = {
          id: '',
          path: entry.path,
          parentPath: entry.parentPath,
          type: entry.type,
          positionX: node.position.x,
          positionY: node.position.y,
          positionZ: node.position.z,
          isPinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
    }

    const newPaths = new Set([newEntry.path]);
    const positions = await runIncrementalLayout(allEntries, sceneObjects, newPaths);

    // Only animate the new entry
    const newPos = positions.get(newEntry.path);
    if (newPos) {
      const node = getMeshByPath(newEntry.path);
      if (node) {
        animateToPosition(node, newPos.x, newPos.z, scene);
      }

      // Update persisted position
      const row = entryToSceneObjectRow(newEntry, new Vector3(newPos.x, 0, newPos.z), 0);
      callbacks.persistBatch([row]).catch(console.error);
    }
  } catch (err) {
    // Incremental layout failed — object stays at grid position
    console.warn('[scene-bridge] Incremental layout failed:', err);
  }
}
