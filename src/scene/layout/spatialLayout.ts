import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy';
import type { FileNode } from '@/types';
import { getFileScale, getColliderHalfExtents } from '@/utils/fileClassification';

// ── Exported Types ──────────────────────────────────────

export interface LayoutEntry {
  id: string;
  position: [number, number, number];
  rotationY?: number;                             // files only
  rotationX?: number;                             // files only — flat spawn tilt
  platformSize?: [number, number];                // dirs only [width, depth]
  cardScale?: number;                             // files only
  colliderHalfExtents?: [number, number, number]; // files only
  parentDirectoryId?: string | null;              // all entries; null = root-level
  totalSizeBytes?: number;                        // dirs only
}

export interface WorkspaceBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  extent: number; // max(width, depth)
}

export interface LayoutResult {
  entries: Map<string, LayoutEntry>;
  bounds: WorkspaceBounds;
}

// ── Constants ───────────────────────────────────────────

const BASE_Y = 0;
const DEPTH_Y_STEP = 0.3;
const PADDING = 0.3;
const FOLDER_GAP = 0.8;
const MIN_PLATFORM_SIZE = 4;
const LAYOUT_SCALE = 4.0;
const LAYOUT_EXPONENT = 0.35;
const BASE_AREA_PER_FILE = 2.0;
const BYTE_WEIGHT = 0.015;

// ── Helpers ─────────────────────────────────────────────

const logScale = (bytes: number): number => Math.log2(Math.max(bytes, 1) + 1);

function countLeafFiles(nodes: FileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') count++;
    else if (node.children) count += countLeafFiles(node.children);
  }
  return count;
}

function computeTotalLogArea(nodes: FileNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (node.type === 'file') total += logScale(Math.max(node.sizeBytes, 100));
    else if (node.children) total += computeTotalLogArea(node.children);
  }
  return total;
}

function computeTotalSize(node: FileNode): number {
  if (node.type === 'file') return Math.max(node.sizeBytes, 100);
  const children = node.children;
  if (!children || children.length === 0) return 100;
  let sum = 0;
  for (const child of children) sum += computeTotalSize(child);
  return sum;
}

// ── D3-compatible tree node ─────────────────────────────

interface TreeNode {
  id: string;
  type: 'file' | 'directory' | 'root';
  value: number;          // treemap area weight
  rawTotalBytes: number;
  sizeBytes?: number;
  children?: TreeNode[];
}

function buildTree(nodes: FileNode[]): TreeNode {
  const children: TreeNode[] = [];

  for (const node of nodes) {
    const rawBytes = computeTotalSize(node);

    if (node.type === 'directory') {
      const leafCount = countLeafFiles(node.children ?? []);
      const mixedSize = Math.max(
        leafCount * BASE_AREA_PER_FILE + Math.sqrt(rawBytes) * BYTE_WEIGHT,
        MIN_PLATFORM_SIZE * MIN_PLATFORM_SIZE,
      );

      const dirChildren = node.children ? buildTree(node.children).children : undefined;

      children.push({
        id: node.id,
        type: 'directory',
        value: mixedSize,
        rawTotalBytes: rawBytes,
        children: dirChildren ?? [],
      });
    } else {
      children.push({
        id: node.id,
        type: 'file',
        value: logScale(rawBytes),
        rawTotalBytes: rawBytes,
        sizeBytes: node.sizeBytes,
      });
    }
  }

  return {
    id: '__virtual_root__',
    type: 'root',
    value: 0,
    rawTotalBytes: 0,
    children,
  };
}

// ── Layout Emission ─────────────────────────────────────

function emitLayout(
  node: HierarchyRectangularNode<TreeNode>,
  depth: number,
  parentDirId: string | null,
  layoutMap: Map<string, LayoutEntry>,
): void {
  const data = node.data;

  if (data.type === 'root') {
    // Skip the virtual root — just recurse into children
    if (node.children) {
      for (const child of node.children) {
        emitLayout(child, 0, null, layoutMap);
      }
    }
    return;
  }

  // d3 treemap coords: x0,y0 = top-left; x1,y1 = bottom-right
  // We map d3's x→our x, d3's y→our z
  const x0 = node.x0;
  const z0 = node.y0;
  const w = node.x1 - node.x0;
  const h = node.y1 - node.y0;

  if (data.type === 'directory') {
    // Platform matches d3's rectangle exactly — spacing between siblings
    // is handled by d3's paddingInner, edge-to-children by paddingOuter.
    const centerX = x0 + w / 2;
    const centerZ = z0 + h / 2;
    const y = BASE_Y + depth * DEPTH_Y_STEP;

    layoutMap.set(data.id, {
      id: data.id,
      position: [centerX, y, centerZ],
      platformSize: [w, h],
      parentDirectoryId: parentDirId,
      totalSizeBytes: data.rawTotalBytes,
    });

    if (node.children) {
      for (const child of node.children) {
        emitLayout(child, depth + 1, data.id, layoutMap);
      }
    }
  } else {
    // File: card at center of its cell
    const centerX = x0 + w / 2;
    const centerZ = z0 + h / 2;

    const cardScale = getFileScale(data.sizeBytes ?? 0);
    const colliderHalf = getColliderHalfExtents(cardScale);

    const parentSurfaceY = depth === 0
      ? BASE_Y
      : BASE_Y + (depth - 1) * DEPTH_Y_STEP + 0.1;
    const y = parentSurfaceY + 0.02;

    layoutMap.set(data.id, {
      id: data.id,
      position: [centerX, y, centerZ],
      rotationY: 0,
      rotationX: -Math.PI / 2,
      cardScale,
      colliderHalfExtents: colliderHalf,
      parentDirectoryId: parentDirId,
    });
  }
}

// ── Main Layout Function ────────────────────────────────

export function calculateLayout(
  nodes: FileNode[],
  _rootPath: string | null,
): LayoutResult {
  const layoutMap = new Map<string, LayoutEntry>();

  const emptyBounds: WorkspaceBounds = {
    minX: -MIN_PLATFORM_SIZE / 2,
    maxX: MIN_PLATFORM_SIZE / 2,
    minZ: -MIN_PLATFORM_SIZE / 2,
    maxZ: MIN_PLATFORM_SIZE / 2,
    extent: MIN_PLATFORM_SIZE,
  };

  // Handle empty input
  if (nodes.length === 0) {
    layoutMap.set('__root__', {
      id: '__root__',
      position: [0, BASE_Y - 0.1, 0],
      platformSize: [MIN_PLATFORM_SIZE, MIN_PLATFORM_SIZE],
    });
    return { entries: layoutMap, bounds: emptyBounds };
  }

  // Compute workspace extent
  const totalLogArea = computeTotalLogArea(nodes);
  const fileCount = countLeafFiles(nodes);
  const totalUnits = Math.max(
    LAYOUT_SCALE * Math.pow(totalLogArea, LAYOUT_EXPONENT),
    MIN_PLATFORM_SIZE,
  );

  // Build d3 hierarchy
  const tree = buildTree(nodes);
  const root = hierarchy(tree)
    .sum((d) => (d.children && d.children.length > 0 ? 0 : d.value))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.data.id.localeCompare(b.data.id));

  // Run d3 squarified treemap
  const halfExtent = totalUnits / 2;
  treemap<TreeNode>()
    .tile(treemapSquarify)
    .size([totalUnits, totalUnits])
    .paddingInner(FOLDER_GAP)
    .paddingOuter(PADDING)(root);

  // Shift coordinates so layout is centered at origin
  function shiftNode(node: HierarchyRectangularNode<TreeNode>): void {
    node.x0 -= halfExtent;
    node.x1 -= halfExtent;
    node.y0 -= halfExtent;
    node.y1 -= halfExtent;
    if (node.children) {
      for (const child of node.children) shiftNode(child);
    }
  }
  shiftNode(root as HierarchyRectangularNode<TreeNode>);

  // Emit layout entries
  emitLayout(root as HierarchyRectangularNode<TreeNode>, 0, null, layoutMap);

  // Add the virtual root platform
  const rootPlatformSize = Math.max(totalUnits, MIN_PLATFORM_SIZE);
  layoutMap.set('__root__', {
    id: '__root__',
    position: [0, BASE_Y - 0.1, 0],
    platformSize: [rootPlatformSize, rootPlatformSize],
  });

  const bounds: WorkspaceBounds = {
    minX: -halfExtent,
    maxX: halfExtent,
    minZ: -halfExtent,
    maxZ: halfExtent,
    extent: totalUnits,
  };

  console.log(`[Layout] ${fileCount} files, totalLogArea=${totalLogArea.toFixed(1)}, extent=${totalUnits.toFixed(1)} units`);

  return { entries: layoutMap, bounds };
}
