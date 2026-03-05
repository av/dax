/**
 * Instance mesh pool — shares geometry across objects of the same file type.
 *
 * Instead of creating unique geometry for every file box, we create one
 * "master mesh" per file category and use Babylon.js InstancedMesh for
 * subsequent objects. This drastically reduces draw calls.
 *
 * The pool provides:
 * - getMasterMesh(category) → creates or returns the shared geometry
 * - createInstance(category, name) → creates an InstancedMesh from the master
 * - Automatic cleanup on scene dispose
 */
import {
  MeshBuilder,
  type Scene,
  type Mesh,
  type InstancedMesh,
} from '@babylonjs/core';
import { getMaterial } from './materials';
import type { FileCategory } from '@shared/file-types';

/** File box dimensions (must match mesh-factory.ts) */
const FILE_WIDTH = 1.2;
const FILE_HEIGHT = 0.8;
const FILE_DEPTH = 0.8;

/** Master meshes per category. The first object of each type creates the master. */
const masterMeshes = new Map<string, Mesh>();

/** Track number of instances per category for naming */
const instanceCounts = new Map<string, number>();

/**
 * Get or create the master (source) mesh for a file category.
 * The master mesh is not rendered directly — only its instances are visible.
 */
export function getMasterMesh(
  category: FileCategory,
  scene: Scene,
): Mesh {
  const key = `pool_${category}`;
  const existing = masterMeshes.get(key);
  if (existing && !existing.isDisposed()) return existing;

  // Create the master mesh
  const master = MeshBuilder.CreateBox(
    key,
    { width: FILE_WIDTH, height: FILE_HEIGHT, depth: FILE_DEPTH },
    scene,
  );

  // Apply material
  master.material = getMaterial(scene, category);

  // Master mesh should not be rendered directly
  master.setEnabled(false);
  master.isPickable = false;

  // Enable shadows on the master (instances inherit this)
  master.receiveShadows = true;

  masterMeshes.set(key, master);
  instanceCounts.set(key, 0);

  return master;
}

/**
 * Create an instanced mesh from the category's master mesh.
 * Instanced meshes share geometry and material with the master,
 * but have their own transform (position/rotation/scale).
 *
 * @param category - File category to determine which master mesh to use
 * @param name - Unique name for this instance
 * @param scene - Babylon.js scene
 * @returns InstancedMesh that shares geometry with the master
 */
export function createPoolInstance(
  category: FileCategory,
  name: string,
  scene: Scene,
): InstancedMesh {
  const master = getMasterMesh(category, scene);
  const key = `pool_${category}`;
  const count = (instanceCounts.get(key) ?? 0) + 1;
  instanceCounts.set(key, count);

  const instance = master.createInstance(`${name}_inst_${count}`);
  instance.isPickable = true;
  instance.receiveShadows = true;

  return instance;
}

/**
 * Check if a category has a master mesh (i.e., instancing is available).
 */
export function hasMasterMesh(category: FileCategory): boolean {
  const key = `pool_${category}`;
  const mesh = masterMeshes.get(key);
  return !!mesh && !mesh.isDisposed();
}

/**
 * Get the total number of active master meshes (categories with instances).
 */
export function getPoolSize(): number {
  return masterMeshes.size;
}

/**
 * Get instance count for a category.
 */
export function getInstanceCount(category: FileCategory): number {
  return instanceCounts.get(`pool_${category}`) ?? 0;
}

/**
 * Dispose all master meshes and clear the pool.
 * Call on scene dispose.
 */
export function clearMeshPool(): void {
  for (const [, master] of masterMeshes) {
    if (!master.isDisposed()) {
      master.dispose(false, true);
    }
  }
  masterMeshes.clear();
  instanceCounts.clear();
}
