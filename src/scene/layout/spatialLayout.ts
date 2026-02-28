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

// ── Internal Types ──────────────────────────────────────

interface TreemapRect {
  x: number;
  z: number;
  width: number;
  depth: number;
}

interface TreemapItem {
  id: string;
  type: 'file' | 'directory';
  totalSize: number;       // log-scaled size (used for proportional area in treemap)
  rawTotalBytes: number;   // raw byte total (preserved for LayoutEntry.totalSizeBytes)
  sizeBytes?: number;
  children?: TreemapItem[];
  rect?: TreemapRect;
}

// ── Constants ───────────────────────────────────────────

const BASE_Y = 0;
const DEPTH_Y_STEP = 0.3;
const PADDING = 0.3;
const FOLDER_GAP = 0.8;
const MIN_PLATFORM_SIZE = 4;
const MIN_CELL_SIZE = 1.5;
const LAYOUT_SCALE = 4.0;
const LAYOUT_EXPONENT = 0.35;
const BASE_AREA_PER_FILE = 2.0;
const BYTE_WEIGHT = 0.015;

// ── Log-Scale Helper ────────────────────────────────────

const logScale = (bytes: number): number => Math.log2(Math.max(bytes, 1) + 1);

// ── Leaf File Counter ───────────────────────────────────

function countLeafFiles(nodes: FileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') {
      count++;
    } else if (node.children) {
      count += countLeafFiles(node.children);
    }
  }
  return count;
}

// ── Total Log-Area Computation ──────────────────────────

function computeTotalLogArea(nodes: FileNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (node.type === 'file') {
      total += logScale(Math.max(node.sizeBytes, 100));
    } else if (node.children) {
      total += computeTotalLogArea(node.children);
    }
  }
  return total;
}

// ── Total Size Computation ──────────────────────────────

function computeTotalSize(node: FileNode): number {
  if (node.type === 'file') {
    return Math.max(node.sizeBytes, 100);
  }

  const children = node.children;
  if (!children || children.length === 0) {
    return 100;
  }

  let sum = 0;
  for (const child of children) {
    sum += computeTotalSize(child);
  }
  return sum;
}

// ── Build TreemapItems from FileNodes ───────────────────

function buildTreemapItems(nodes: FileNode[]): TreemapItem[] {
  const items: TreemapItem[] = [];

  for (const node of nodes) {
    const rawBytes = computeTotalSize(node);

    if (node.type === 'directory') {
      const children = node.children
        ? buildTreemapItems(node.children)
        : undefined;

      const leafCount = countLeafFiles(node.children ?? []);
      const mixedSize = leafCount * BASE_AREA_PER_FILE + Math.sqrt(rawBytes) * BYTE_WEIGHT;

      items.push({
        id: node.id,
        type: 'directory',
        totalSize: mixedSize,
        rawTotalBytes: rawBytes,
        children,
      });
    } else {
      const scaledSize = logScale(rawBytes);
      items.push({
        id: node.id,
        type: 'file',
        totalSize: scaledSize,
        rawTotalBytes: rawBytes,
        sizeBytes: node.sizeBytes,
      });
    }
  }

  return items;
}

// ── Aspect Ratio Helper ─────────────────────────────────

function worstAspectRatio(areas: number[], sideLength: number): number {
  if (areas.length === 0 || sideLength <= 0) return Infinity;

  let totalArea = 0;
  for (const a of areas) {
    totalArea += a;
  }

  const rowWidth = totalArea / sideLength;
  if (rowWidth <= 0) return Infinity;

  let worst = 0;
  for (const area of areas) {
    const itemLength = area / rowWidth;
    if (itemLength <= 0) continue;
    const aspect = Math.max(rowWidth / itemLength, itemLength / rowWidth);
    if (aspect > worst) worst = aspect;
  }

  return worst;
}

// ── Layout a Single Row ─────────────────────────────────

function layoutRow(
  row: TreemapItem[],
  rect: TreemapRect,
  sideLength: number,
  horizontal: boolean,
): TreemapRect {
  let totalArea = 0;
  for (const item of row) {
    totalArea += item.totalSize;
  }

  const rowThickness = sideLength > 0 ? totalArea / sideLength : 0;

  let offset = 0;
  for (const item of row) {
    const itemLength = rowThickness > 0 ? item.totalSize / rowThickness : 0;

    if (horizontal) {
      // Row runs along the x-axis (width), sliced from the z-axis (depth)
      item.rect = {
        x: rect.x + offset,
        z: rect.z,
        width: itemLength,
        depth: rowThickness,
      };
    } else {
      // Row runs along the z-axis (depth), sliced from the x-axis (width)
      item.rect = {
        x: rect.x,
        z: rect.z + offset,
        width: rowThickness,
        depth: itemLength,
      };
    }

    offset += itemLength;
  }

  // Return the remaining rect after slicing off the row
  if (horizontal) {
    return {
      x: rect.x,
      z: rect.z + rowThickness,
      width: rect.width,
      depth: rect.depth - rowThickness,
    };
  } else {
    return {
      x: rect.x + rowThickness,
      z: rect.z,
      width: rect.width - rowThickness,
      depth: rect.depth,
    };
  }
}

// ── Squarified Treemap Algorithm ────────────────────────

function squarify(items: TreemapItem[], rect: TreemapRect): void {
  if (items.length === 0) return;

  // Single item: assign the whole rect
  if (items.length === 1) {
    items[0].rect = { ...rect };
    return;
  }

  // Sort descending by totalSize
  const sorted = [...items].sort((a, b) => b.totalSize - a.totalSize);

  // Compute total area of all items for scaling
  let totalItemSize = 0;
  for (const item of sorted) {
    totalItemSize += item.totalSize;
  }

  const totalRectArea = rect.width * rect.depth;

  // Scale item sizes to match rect area
  const scale = totalItemSize > 0 ? totalRectArea / totalItemSize : 0;

  squarifyRecursive(
    sorted.map((item) => ({ item, area: item.totalSize * scale })),
    { ...rect },
  );
}

interface ItemWithArea {
  item: TreemapItem;
  area: number;
}

function squarifyRecursive(
  items: ItemWithArea[],
  rect: TreemapRect,
): void {
  if (items.length === 0) return;

  if (items.length === 1) {
    items[0].item.rect = { ...rect };
    return;
  }

  // Ensure rect dimensions are positive
  if (rect.width <= 0 || rect.depth <= 0) {
    // Degenerate case: assign all items zero-size rects at rect origin
    for (const { item } of items) {
      item.rect = { x: rect.x, z: rect.z, width: 0, depth: 0 };
    }
    return;
  }

  const horizontal = rect.width >= rect.depth;
  const sideLength = horizontal ? rect.width : rect.depth;

  const row: ItemWithArea[] = [items[0]];
  let rowAreas = [items[0].area];
  let currentWorst = worstAspectRatio(rowAreas, sideLength);

  let i = 1;
  while (i < items.length) {
    const candidateAreas = [...rowAreas, items[i].area];
    const candidateWorst = worstAspectRatio(candidateAreas, sideLength);

    if (candidateWorst <= currentWorst || candidateWorst <= 3.5) {
      row.push(items[i]);
      rowAreas = candidateAreas;
      currentWorst = candidateWorst;
      i++;
    } else {
      break;
    }
  }

  // Layout the current row — use the actual items' totalSize for proportional sizing
  // but we need to temporarily set totalSize to area for layoutRow
  const originalSizes: number[] = [];
  for (const entry of row) {
    originalSizes.push(entry.item.totalSize);
    entry.item.totalSize = entry.area;
  }

  const remaining = layoutRow(
    row.map((r) => r.item),
    rect,
    sideLength,
    horizontal,
  );

  // Restore original totalSize values
  for (let j = 0; j < row.length; j++) {
    row[j].item.totalSize = originalSizes[j];
  }

  // Recurse with remaining items
  if (i < items.length) {
    squarifyRecursive(items.slice(i), remaining);
  }
}

// ── Layout a Single TreemapItem ─────────────────────────

function layoutTreemapItem(
  item: TreemapItem,
  depth: number,
  parentDirId: string | null,
  layoutMap: Map<string, LayoutEntry>,
): void {
  const itemRect = item.rect;
  if (!itemRect) return;

  if (item.type === 'directory') {
    // Inset the allocated rect by FOLDER_GAP/2 on each side to create
    // visible separation between adjacent sibling directories.
    const halfGap = FOLDER_GAP / 2;
    const insetRect: TreemapRect = {
      x: itemRect.x + halfGap,
      z: itemRect.z + halfGap,
      width: Math.max(itemRect.width - FOLDER_GAP, MIN_CELL_SIZE),
      depth: Math.max(itemRect.depth - FOLDER_GAP, MIN_CELL_SIZE),
    };

    // Directory: platform at center of its inset rect
    const centerX = insetRect.x + insetRect.width / 2;
    const centerZ = insetRect.z + insetRect.depth / 2;
    const y = BASE_Y + depth * DEPTH_Y_STEP;

    layoutMap.set(item.id, {
      id: item.id,
      position: [centerX, y, centerZ],
      platformSize: [insetRect.width, insetRect.depth],
      parentDirectoryId: parentDirId,
      totalSizeBytes: item.rawTotalBytes,
    });

    // Recursively layout children inside a padded sub-rect
    const children = item.children;
    if (children && children.length > 0) {
      const paddedRect: TreemapRect = {
        x: insetRect.x + PADDING,
        z: insetRect.z + PADDING,
        width: Math.max(insetRect.width - PADDING * 2, MIN_CELL_SIZE),
        depth: Math.max(insetRect.depth - PADDING * 2, MIN_CELL_SIZE),
      };

      squarify(children, paddedRect);

      for (const child of children) {
        layoutTreemapItem(child, depth + 1, item.id, layoutMap);
      }
    }
  } else {
    // File: card at center of its rect
    const centerX = itemRect.x + itemRect.width / 2;
    const centerZ = itemRect.z + itemRect.depth / 2;

    const cardScale = getFileScale(item.sizeBytes ?? 0);
    const colliderHalf = getColliderHalfExtents(cardScale);

    // Spawn flat just above the parent platform surface (collider half-height = 0.1)
    const parentSurfaceY = depth === 0
      ? BASE_Y
      : BASE_Y + (depth - 1) * DEPTH_Y_STEP + 0.1;
    const y = parentSurfaceY + 0.02;

    layoutMap.set(item.id, {
      id: item.id,
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

/**
 * Calculate spatial layout for all FileNodes using a squarified treemap algorithm.
 *
 * Returns a LayoutResult containing a Map of node id → world position + layout
 * metadata, plus workspace bounds. File areas are log-scaled so large files
 * don't dominate the workspace.
 */
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

  // Build treemap item tree from FileNodes
  const treemapItems = buildTreemapItems(nodes);

  // Compute log-scaled total area and leaf file count
  const totalLogArea = computeTotalLogArea(nodes);
  const fileCount = countLeafFiles(nodes);

  // Workspace extent formula: power-law scaling of log-area gives
  // ~20 units for 10 small files and ~300 units for 10k mixed files
  const totalUnits = Math.max(
    LAYOUT_SCALE * Math.pow(totalLogArea, LAYOUT_EXPONENT),
    MIN_PLATFORM_SIZE,
  );

  // Root rect centered at origin
  const rootRect: TreemapRect = {
    x: -totalUnits / 2,
    z: -totalUnits / 2,
    width: totalUnits,
    depth: totalUnits,
  };

  // Run squarified treemap on root items
  squarify(treemapItems, rootRect);

  // Layout each item recursively
  for (const item of treemapItems) {
    layoutTreemapItem(item, 0, null, layoutMap);
  }

  // Add the virtual root platform
  const rootPlatformSize = Math.max(totalUnits, MIN_PLATFORM_SIZE);
  layoutMap.set('__root__', {
    id: '__root__',
    position: [0, BASE_Y - 0.1, 0],
    platformSize: [rootPlatformSize, rootPlatformSize],
  });

  const bounds: WorkspaceBounds = {
    minX: -totalUnits / 2,
    maxX: totalUnits / 2,
    minZ: -totalUnits / 2,
    maxZ: totalUnits / 2,
    extent: totalUnits,
  };

  console.log(`[Layout] ${fileCount} files, totalLogArea=${totalLogArea.toFixed(1)}, extent=${totalUnits.toFixed(1)} units`);

  return { entries: layoutMap, bounds };
}
