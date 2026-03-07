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
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import { LOD1_DISTANCE, LOD2_DISTANCE } from '@shared/constants';
import { getCategoryColor3 } from './materials';
import type { FileCategory } from '@shared/file-types';

/** Cache for LOD1 materials per category */
const lod1MatCache = new Map<string, StandardMaterial>();

/** Cache for LOD2 materials per category */
const lod2MatCache = new Map<string, StandardMaterial>();

/** Counter for unique LOD mesh names */
let lodIdCounter = 0;

/**
 * Set up LOD levels for a mesh based on its file category.
 *
 * Creates unique LOD meshes per parent mesh (BabylonJS does not allow
 * the same mesh instance to be used as an LOD level on multiple parents).
 * Materials are cached and shared across meshes for efficiency.
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
  const lod1 = createLOD1(category, scene);
  lod1.parent = mesh.parent; // Inherit parent so LOD renders at the correct position
  mesh.addLODLevel(LOD1_DISTANCE, lod1);

  // LOD2: Billboard (null = disappear at distance, or use a simple plane)
  const lod2 = createLOD2(category, scene);
  lod2.parent = mesh.parent; // Inherit parent so LOD renders at the correct position
  mesh.addLODLevel(LOD2_DISTANCE, lod2);
}

/**
 * Get or create a StandardMaterial for LOD1 meshes of a given category.
 */
function getLOD1Material(category: FileCategory | 'folder', scene: Scene): StandardMaterial {
  const key = `lod1_${category}`;
  const cached = lod1MatCache.get(key);
  if (cached) return cached;

  const mat = new StandardMaterial(`${key}_mat`, scene);
  const color = getCategoryColor3(category);
  mat.diffuseColor = color;
  mat.specularColor = Color3.Black();

  lod1MatCache.set(key, mat);
  return mat;
}

/**
 * Get or create a StandardMaterial for LOD2 meshes of a given category.
 */
function getLOD2Material(category: FileCategory | 'folder', scene: Scene): StandardMaterial {
  const key = `lod2_${category}`;
  const cached = lod2MatCache.get(key);
  if (cached) return cached;

  const mat = new StandardMaterial(`${key}_mat`, scene);
  const color = getCategoryColor3(category);
  mat.diffuseColor = color;
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;

  lod2MatCache.set(key, mat);
  return mat;
}

/**
 * Create a unique simplified LOD1 mesh for a parent mesh.
 * Uses a simple box with a cached StandardMaterial (not PBR — cheaper to render).
 */
function createLOD1(category: FileCategory | 'folder', scene: Scene): Mesh {
  const id = lodIdCounter++;
  const lod1 = MeshBuilder.CreateBox(
    `lod1_${category}_${id}`,
    { width: 1.2, height: 0.8, depth: 0.8 },
    scene,
  );

  lod1.material = getLOD1Material(category, scene);

  // Don't render this mesh directly — it's only used as LOD replacement
  lod1.setEnabled(false);
  lod1.isPickable = false;

  return lod1;
}

/**
 * Create a unique billboard LOD2 mesh for a parent mesh.
 * A simple colored plane that always faces the camera.
 */
function createLOD2(category: FileCategory | 'folder', scene: Scene): Mesh {
  const id = lodIdCounter++;
  const lod2 = MeshBuilder.CreatePlane(
    `lod2_${category}_${id}`,
    { width: 1.0, height: 1.0 },
    scene,
  );

  // Billboard mode: always face camera
  lod2.billboardMode = 7; // BILLBOARDMODE_ALL

  lod2.material = getLOD2Material(category, scene);

  lod2.setEnabled(false);
  lod2.isPickable = false;

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
 * Clear LOD material caches. Call on scene dispose.
 * Individual LOD meshes are disposed with their parent meshes.
 */
export function clearLODCache(): void {
  for (const [, mat] of lod1MatCache) {
    mat.dispose();
  }
  for (const [, mat] of lod2MatCache) {
    mat.dispose();
  }
  lod1MatCache.clear();
  lod2MatCache.clear();
  lodIdCounter = 0;
}
