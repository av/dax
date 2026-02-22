import type { FileNode } from '@/types';

export interface LayoutEntry {
  id: string;
  position: [number, number, number];
  rotationY?: number; // Y-axis rotation in radians
  platformSize?: [number, number]; // width, depth — only for directories
}

/* ── Deterministic pseudo-random seeded by a string ─────────────────── */
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

/** Return N deterministic random values in [0,1) for a given seed string. */
function seededRandomN(seed: string, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(seededRandom(seed + ':' + i));
  }
  return out;
}

/* ── Layout constants ───────────────────────────────────────────────── */
const CLUSTER_SPACING = 2.2; // centre-to-centre target (tighter than old 3.0)
const JITTER_XZ = 0.5; // ±random offset on X / Z
const JITTER_Y = 0.1; // slight Y variation so cards aren't coplanar
const MAX_ROTATION_Y = Math.PI / 6; // ±30° random yaw
const DIRECTORY_Y_STEP = 4.0;
const PLATFORM_PADDING = 2.0;

/**
 * Calculate spatial layout for all FileNodes.
 * Files are scattered in a loose organic cluster on their parent directory's
 * platform. Directories are elevated platforms positioned recursively.
 *
 * Returns a Map of node id → world position (+ optional rotationY & platformSize).
 */
export function calculateLayout(
  nodes: FileNode[],
  rootPath: string | null,
): Map<string, LayoutEntry> {
  const result = new Map<string, LayoutEntry>();

  if (nodes.length === 0) return result;

  // Build a flat list from the tree, processing recursively
  layoutDirectory(nodes, 0, 0, 0, 0, result);

  // If we have a root, add a virtual root platform
  if (rootPath) {
    const rootFiles = nodes.filter((n) => n.type === 'file');
    const rootDirs = nodes.filter((n) => n.type === 'directory');
    const totalItems = rootFiles.length + rootDirs.length;
    const rings = Math.ceil(Math.sqrt(totalItems));
    const width = rings * CLUSTER_SPACING * 2 + PLATFORM_PADDING * 2;
    const depth = rings * CLUSTER_SPACING * 2 + PLATFORM_PADDING * 2;

    result.set('__root__', {
      id: '__root__',
      position: [0, -0.1, 0],
      platformSize: [Math.max(width, 10), Math.max(depth, 10)],
    });
  }

  return result;
}

/**
 * Place files in a loose spiral/cluster centred on (offsetX, offsetY, offsetZ),
 * then recurse into sub-directories.
 */
function layoutDirectory(
  children: FileNode[],
  depth: number,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  result: Map<string, LayoutEntry>,
): [number, number] {
  const files = children.filter((n) => n.type === 'file');
  const dirs = children.filter((n) => n.type === 'directory');

  /* ── Organic file cluster using a Fermat-spiral + jitter ────────── */
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
  let maxR = 0;

  files.forEach((file, index) => {
    // Fermat spiral: r grows with sqrt(index), angle increments by golden angle
    const r = CLUSTER_SPACING * Math.sqrt(index);
    const theta = index * goldenAngle;

    // Base spiral position
    const baseX = r * Math.cos(theta);
    const baseZ = r * Math.sin(theta);

    // Deterministic jitter per file
    const rands = seededRandomN(file.id, 4);
    const jx = (rands[0] - 0.5) * 2 * JITTER_XZ; // −0.5 … +0.5
    const jz = (rands[1] - 0.5) * 2 * JITTER_XZ;
    const jy = rands[2] * JITTER_Y; // 0 … 0.1
    const rotY = (rands[3] - 0.5) * 2 * MAX_ROTATION_Y; // ±30°

    const x = offsetX + baseX + jx;
    const z = offsetZ + baseZ + jz;
    const y = offsetY + 0.5 + jy;

    result.set(file.id, {
      id: file.id,
      position: [x, y, z],
      rotationY: rotY,
    });

    const dist = Math.sqrt((baseX + jx) ** 2 + (baseZ + jz) ** 2);
    if (dist > maxR) maxR = dist;
  });

  // Cluster bounding area (circle → box approximation)
  const fileAreaWidth = (maxR + CLUSTER_SPACING) * 2 + PLATFORM_PADDING * 2;
  const fileAreaDepth = fileAreaWidth; // roughly circular cluster

  /* ── Sub-directories — same side-by-side logic as before ────────── */
  let dirOffsetX = offsetX - ((dirs.length - 1) * CLUSTER_SPACING * 3) / 2;
  const dirOffsetZ =
    offsetZ +
    (files.length > 0 ? maxR + CLUSTER_SPACING * 2 : 0);

  let maxDirWidth = 0;
  let maxDirDepth = 0;

  for (const dir of dirs) {
    const dirY = offsetY + DIRECTORY_Y_STEP;
    const dirChildren = dir.children ?? [];

    const [childWidth, childDepth] = layoutDirectory(
      dirChildren,
      depth + 1,
      dirOffsetX,
      dirY,
      dirOffsetZ,
      result,
    );

    const platformWidth = Math.max(childWidth, 6);
    const platformDepth = Math.max(childDepth, 6);

    result.set(dir.id, {
      id: dir.id,
      position: [dirOffsetX, dirY, dirOffsetZ],
      platformSize: [platformWidth, platformDepth],
    });

    dirOffsetX += platformWidth + CLUSTER_SPACING;
    maxDirWidth += platformWidth + CLUSTER_SPACING;
    maxDirDepth = Math.max(maxDirDepth, platformDepth);
  }

  const totalWidth = Math.max(fileAreaWidth, maxDirWidth);
  const totalDepth =
    fileAreaDepth + (dirs.length > 0 ? maxDirDepth + CLUSTER_SPACING * 2 : 0);

  return [totalWidth, totalDepth];
}
