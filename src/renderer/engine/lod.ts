/**
 * LOD (Level of Detail) manager.
 *
 * Manages three LOD levels for scene meshes:
 * - LOD0: Full mesh (default) — shown when camera is close
 * - LOD1: Simplified mesh (reduced geometry) — shown when camera distance > 100 units
 * - LOD2: Billboard sprite (flat plane) — shown when camera distance > 200 units
 *
 * Uses Babylon.js built-in LOD system via mesh.addLODLevel().
 */
import {
  MeshBuilder,
  type Scene,
  type Mesh,
  type AbstractMesh,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import { LOD1_DISTANCE, LOD2_DISTANCE } from '@shared/constants';
import { getCategoryColor3 } from './materials';
import type { FileCategory } from '@shared/file-types';

/** Cache for LOD1 simplified meshes per category */
const lod1Cache = new Map<string, Mesh>();

/** Cache for LOD2 billboard meshes per category */
const lod2Cache = new Map<string, Mesh>();

/**
 * Set up LOD levels for a mesh based on its file category.
 *
 * @param mesh - The full detail (LOD0) mesh
 * @param category - File category for material coloring
 * @param scene - Babylon.js scene
 */
export function setupLOD(
  mesh: Mesh,
  category: FileCategory | 'folder',
  scene: Scene,
): void {
  // LOD1: Simplified box (fewer subdivisions, simpler material)
  const lod1 = getOrCreateLOD1(category, scene);
  mesh.addLODLevel(LOD1_DISTANCE, lod1);

  // LOD2: Billboard (null = disappear at distance, or use a simple plane)
  const lod2 = getOrCreateLOD2(category, scene);
  mesh.addLODLevel(LOD2_DISTANCE, lod2);
}

/**
 * Get or create a simplified LOD1 mesh for a category.
 * Uses a simple box with a basic material (not PBR — cheaper to render).
 */
function getOrCreateLOD1(category: FileCategory | 'folder', scene: Scene): Mesh {
  const key = `lod1_${category}`;
  const cached = lod1Cache.get(key);
  if (cached && !cached.isDisposed()) return cached;

  // Create a simpler box (no round edges, lower-quality material)
  const lod1 = MeshBuilder.CreateBox(
    key,
    { width: 1.2, height: 0.8, depth: 0.8 },
    scene,
  );

  // Use cheaper StandardMaterial instead of PBR
  const mat = new StandardMaterial(`${key}_mat`, scene);
  const color = getCategoryColor3(category);
  mat.diffuseColor = color;
  mat.specularColor = Color3.Black();
  lod1.material = mat;

  // Don't render this mesh directly — it's only used as LOD replacement
  lod1.setEnabled(false);
  lod1.isPickable = false;

  lod1Cache.set(key, lod1);
  return lod1;
}

/**
 * Get or create a billboard LOD2 mesh for a category.
 * A simple colored plane that always faces the camera.
 */
function getOrCreateLOD2(category: FileCategory | 'folder', scene: Scene): Mesh {
  const key = `lod2_${category}`;
  const cached = lod2Cache.get(key);
  if (cached && !cached.isDisposed()) return cached;

  const lod2 = MeshBuilder.CreatePlane(
    key,
    { width: 1.0, height: 1.0 },
    scene,
  );

  // Billboard mode: always face camera
  lod2.billboardMode = 7; // BILLBOARDMODE_ALL

  const mat = new StandardMaterial(`${key}_mat`, scene);
  const color = getCategoryColor3(category);
  mat.diffuseColor = color;
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  lod2.material = mat;

  lod2.setEnabled(false);
  lod2.isPickable = false;

  lod2Cache.set(key, lod2);
  return lod2;
}

/**
 * Verify that frustum culling is active (Babylon.js enables it by default).
 * Returns true if the scene has frustum culling enabled.
 */
export function verifyFrustumCulling(scene: Scene): boolean {
  // Babylon.js enables frustum culling by default on all meshes.
  // We verify by checking a few meshes — mesh.alwaysSelectAsActiveMesh should be false.
  const meshes = scene.meshes;
  for (const mesh of meshes) {
    if (mesh.alwaysSelectAsActiveMesh) {
      // Found a mesh bypassing frustum culling — this is unexpected
      return false;
    }
  }
  return true;
}

/**
 * Clear LOD caches. Call on scene dispose.
 */
export function clearLODCache(): void {
  for (const [, mesh] of lod1Cache) {
    if (!mesh.isDisposed()) mesh.dispose();
  }
  for (const [, mesh] of lod2Cache) {
    if (!mesh.isDisposed()) mesh.dispose();
  }
  lod1Cache.clear();
  lod2Cache.clear();
}
