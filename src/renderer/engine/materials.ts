/**
 * Material palette — PBR materials per file type category.
 *
 * Each file category gets a distinct color for visual differentiation:
 * - code    = blue (#4a9eff)
 * - image   = green (#4aff7e)
 * - document = amber (#ffb84a)
 * - data    = cyan (#4affef)
 * - archive = purple (#b84aff)
 * - media   = pink (#ff4a8a)
 * - binary  = red (#ff4a4a)
 * - unknown = gray (#8a8a9a)
 * - folder  = slate (#5a6a8a)
 */
import {
  Scene,
  PBRMaterial,
  Color3,
} from '@babylonjs/core';
import type { FileCategory } from '@shared/file-types';

/** Color definitions per file category */
export const CATEGORY_COLORS: Record<FileCategory | 'folder', { r: number; g: number; b: number }> = {
  code:     { r: 0.29, g: 0.62, b: 1.0 },   // #4a9eff
  image:    { r: 0.29, g: 1.0,  b: 0.49 },   // #4aff7e
  document: { r: 1.0,  g: 0.72, b: 0.29 },   // #ffb84a
  data:     { r: 0.29, g: 1.0,  b: 0.94 },   // #4affef
  archive:  { r: 0.72, g: 0.29, b: 1.0 },    // #b84aff
  media:    { r: 1.0,  g: 0.29, b: 0.54 },   // #ff4a8a
  binary:   { r: 1.0,  g: 0.29, b: 0.29 },   // #ff4a4a
  unknown:  { r: 0.54, g: 0.54, b: 0.60 },   // #8a8a9a
  folder:   { r: 0.35, g: 0.42, b: 0.54 },   // #5a6a8a
};

/** Cache for created materials */
const materialCache = new Map<string, PBRMaterial>();

/**
 * Get or create a PBR material for a file category.
 * Materials are cached and reused across meshes of the same category.
 */
export function getMaterial(scene: Scene, category: FileCategory | 'folder'): PBRMaterial {
  const key = `mat_${category}`;
  const cached = materialCache.get(key);
  if (cached) return cached;

  const color = CATEGORY_COLORS[category];
  const mat = new PBRMaterial(key, scene);
  mat.albedoColor = new Color3(color.r, color.g, color.b);
  mat.roughness = 0.8;
  mat.metallic = 0.1;
  // Subtle emissive for visibility in dark scenes
  mat.emissiveColor = new Color3(color.r * 0.08, color.g * 0.08, color.b * 0.08);

  materialCache.set(key, mat);
  return mat;
}

/**
 * Get the Color3 for a category (used for labels, glow effects, etc.)
 */
export function getCategoryColor3(category: FileCategory | 'folder'): Color3 {
  const c = CATEGORY_COLORS[category];
  return new Color3(c.r, c.g, c.b);
}

/**
 * Clear the material cache (call on scene dispose).
 */
export function clearMaterialCache(): void {
  materialCache.clear();
}
