import type { LayoutEntry } from '@/scene/layout/spatialLayout';

export interface DirAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Compute the inset AABB for a directory platform, used to clamp
 * file positions so they stay within the physical fence walls.
 */
export function getDirAABB(
  id: string,
  layoutMap: Map<string, LayoutEntry>,
  inset = 0.5,
): DirAABB | null {
  const entry = layoutMap.get(id);
  if (!entry?.platformSize) return null;
  const [px, , pz] = entry.position;
  const [pw, pd] = entry.platformSize;
  return {
    minX: px - pw / 2 + inset,
    maxX: px + pw / 2 - inset,
    minZ: pz - pd / 2 + inset,
    maxZ: pz + pd / 2 - inset,
  };
}
