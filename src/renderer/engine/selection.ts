/**
 * Selection system — HighlightLayer-based selection outlines, ghost outlines during drag,
 * and folder highlight (green glow) during drop hover.
 *
 * Uses Babylon.js HighlightLayer for selection outlines.
 */
import {
  HighlightLayer,
  Color3,
  type Scene,
  type AbstractMesh,
  type Mesh,
  type TransformNode,
  MeshBuilder,
  StandardMaterial,
} from '@babylonjs/core';

let highlightLayer: HighlightLayer | null = null;
let folderHighlight: HighlightLayer | null = null;
let searchHighlight: HighlightLayer | null = null;

/** Set of currently highlighted mesh IDs */
const highlightedMeshes = new Set<string>();

/** Ghost mesh created during drag */
const ghostMeshes = new Map<string, AbstractMesh>();

/** Set of meshes dimmed by search */
const dimmedMeshes = new Set<AbstractMesh>();

/** Set of meshes highlighted by search */
const searchHighlightedMeshes = new Set<AbstractMesh>();

/**
 * Initialize the selection highlight layers.
 */
export function initSelectionSystem(scene: Scene): void {
  // Primary selection highlight (blue)
  highlightLayer = new HighlightLayer('selectionHighlight', scene, {
    blurHorizontalSize: 0.5,
    blurVerticalSize: 0.5,
  });
  highlightLayer.innerGlow = false;
  highlightLayer.outerGlow = true;

  // Folder drop-target highlight (green)
  folderHighlight = new HighlightLayer('folderHighlight', scene, {
    blurHorizontalSize: 0.8,
    blurVerticalSize: 0.8,
  });
  folderHighlight.innerGlow = true;
  folderHighlight.outerGlow = true;

  // Search result highlight (yellow/amber glow)
  searchHighlight = new HighlightLayer('searchHighlight', scene, {
    blurHorizontalSize: 1.0,
    blurVerticalSize: 1.0,
  });
  searchHighlight.innerGlow = true;
  searchHighlight.outerGlow = true;
}

/**
 * Add selection highlight to a mesh.
 */
export function addSelectionHighlight(mesh: AbstractMesh): void {
  if (!highlightLayer) return;
  if (highlightedMeshes.has(mesh.uniqueId.toString())) return;

  highlightLayer.addMesh(mesh as Mesh, Color3.FromHexString('#4fc3f7'));
  highlightedMeshes.add(mesh.uniqueId.toString());
}

/**
 * Remove selection highlight from a mesh.
 */
export function removeSelectionHighlight(mesh: AbstractMesh): void {
  if (!highlightLayer) return;
  highlightLayer.removeMesh(mesh as Mesh);
  highlightedMeshes.delete(mesh.uniqueId.toString());
}

/**
 * Clear all selection highlights.
 */
export function clearAllHighlights(): void {
  if (!highlightLayer) return;
  highlightLayer.removeAllMeshes();
  highlightedMeshes.clear();
}

/**
 * Highlight a folder as a valid drop target (green glow).
 */
export function addFolderDropHighlight(mesh: AbstractMesh): void {
  if (!folderHighlight) return;
  folderHighlight.addMesh(mesh as Mesh, Color3.FromHexString('#4caf50'));
}

/**
 * Remove folder drop highlight.
 */
export function removeFolderDropHighlight(mesh: AbstractMesh): void {
  if (!folderHighlight) return;
  folderHighlight.removeMesh(mesh as Mesh);
}

/**
 * Clear all folder drop highlights.
 */
export function clearFolderHighlights(): void {
  if (!folderHighlight) return;
  folderHighlight.removeAllMeshes();
}

/**
 * Create a ghost outline at the original position of a dragged object.
 */
export function createGhostOutline(
  originalMesh: TransformNode,
  scene: Scene,
): AbstractMesh | null {
  const meshId = originalMesh.name;
  if (ghostMeshes.has(meshId)) return ghostMeshes.get(meshId)!;

  // Find the main mesh child to get dimensions
  const mainChild = originalMesh.getChildMeshes(true)[0];
  if (!mainChild) return null;

  const bounds = mainChild.getBoundingInfo().boundingBox;
  const size = bounds.maximum.subtract(bounds.minimum);

  // Create a simple wireframe box at the original position
  const ghost = MeshBuilder.CreateBox(
    `ghost_${meshId}`,
    {
      width: Math.max(size.x, 0.5),
      height: Math.max(size.y, 0.5),
      depth: Math.max(size.z, 0.5),
    },
    scene,
  );

  ghost.position = originalMesh.position.clone();
  ghost.position.y += Math.max(size.y, 0.5) / 2;

  // Semi-transparent wireframe material
  const mat = new StandardMaterial(`ghostMat_${meshId}`, scene);
  mat.wireframe = true;
  mat.emissiveColor = new Color3(0.3, 0.6, 1.0);
  mat.alpha = 0.3;
  mat.disableLighting = true;
  ghost.material = mat;
  ghost.isPickable = false;

  ghostMeshes.set(meshId, ghost);
  return ghost;
}

/**
 * Remove the ghost outline for a dragged object.
 */
export function removeGhostOutline(meshId: string): void {
  const ghost = ghostMeshes.get(meshId);
  if (ghost) {
    ghost.dispose();
    ghostMeshes.delete(meshId);
  }
}

/**
 * Remove all ghost outlines.
 */
export function clearAllGhosts(): void {
  for (const [, ghost] of ghostMeshes) {
    ghost.dispose();
  }
  ghostMeshes.clear();
}

/**
 * Get the highlight layer instance.
 */
export function getHighlightLayer(): HighlightLayer | null {
  return highlightLayer;
}

/**
 * Apply search highlights: matched objects glow, non-matched dim to 30% opacity.
 *
 * @param matchedPaths - Set of file paths that match the search
 * @param getMeshByPath - Function to look up a mesh by path
 * @param allPaths - All known file paths in the scene
 */
export function applySearchHighlights(
  matchedPaths: Set<string>,
  getMeshByPath: (path: string) => TransformNode | undefined,
  allPaths: string[],
): void {
  clearSearchHighlights();

  for (const path of allPaths) {
    const node = getMeshByPath(path);
    if (!node) continue;

    const meshes = node.getChildMeshes(false);
    if (matchedPaths.has(path)) {
      // Glow: add to search highlight layer
      for (const mesh of meshes) {
        if (searchHighlight && !mesh.name.startsWith('label_') && !mesh.name.startsWith('ghost_')) {
          searchHighlight.addMesh(mesh as Mesh, Color3.FromHexString('#ffb74d'));
          searchHighlightedMeshes.add(mesh);
        }
      }
    } else {
      // Dim to 30% opacity
      for (const mesh of meshes) {
        mesh.visibility = 0.3;
        dimmedMeshes.add(mesh);
      }
    }
  }
}

/**
 * Clear all search highlights and restore normal visibility.
 */
export function clearSearchHighlights(): void {
  // Remove search glow
  if (searchHighlight) {
    searchHighlight.removeAllMeshes();
  }
  searchHighlightedMeshes.clear();

  // Restore dimmed meshes to full opacity
  for (const mesh of dimmedMeshes) {
    if (!mesh.isDisposed()) {
      mesh.visibility = 1;
    }
  }
  dimmedMeshes.clear();
}

/**
 * Dispose the selection system.
 */
export function disposeSelectionSystem(): void {
  clearAllHighlights();
  clearFolderHighlights();
  clearAllGhosts();
  clearSearchHighlights();
  if (highlightLayer) {
    highlightLayer.dispose();
    highlightLayer = null;
  }
  if (folderHighlight) {
    folderHighlight.dispose();
    folderHighlight = null;
  }
  if (searchHighlight) {
    searchHighlight.dispose();
    searchHighlight = null;
  }
}
