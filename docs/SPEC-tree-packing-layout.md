# Tree Packing Layout Specification

**Feature**: Size-proportional tree packing layout for directories in Dax's 3D workspace
**Status**: Draft
**Date**: 2026-02-24

---

## 1. Feature List

### F1: Size-Proportional File Objects

**What it does**: Each file card is scaled in 3D proportionally to its `sizeBytes` on disk. A 1 MB file is visually larger than a 1 KB file. The existing `getFileScale` formula is replaced with a new one that also drives collider dimensions.

**Inputs**: `FileNode.sizeBytes`
**Outputs**: Visual scale applied to the instanced card mesh AND a matching collider half-extent applied per-instance.

**Success criteria**:
- SC-F1-1: Two files of different sizes placed side by side have visibly different card dimensions.
- SC-F1-2: A 10 KB file is visibly smaller than a 100 KB file.
- SC-F1-3: Collider dimensions match the visual mesh scale (no phantom collisions, no fall-through).
- SC-F1-4: A 0-byte file still renders at the minimum scale (0.4).
- SC-F1-5: A 1 GB file does not exceed max scale (2.5).

### F2: Size-Proportional Directory Containers

**What it does**: Each directory is rendered as a 3D container whose footprint is proportional to the total `sizeBytes` of all its descendants. Directories containing more data occupy more XZ area.

**Inputs**: `FileNode.sizeBytes` for directories (currently reports inode size on Linux, which is meaningless), plus recursive sum of child sizes.
**Outputs**: `LayoutEntry.platformSize` reflecting total descendant bytes.

**Success criteria**:
- SC-F2-1: A directory containing 50 MB of files has a larger platform than a directory containing 500 KB.
- SC-F2-2: An empty directory renders at the minimum platform size (4x4 world units).
- SC-F2-3: Platform sizes recompute when the file watcher reports add/unlink/change events.

### F3: Recursive Rectangle Packing

**What it does**: Files and subdirectories within a directory are laid out using a squarified treemap algorithm on the XZ plane. Each child rectangle's area is proportional to its `sizeBytes`. Subdirectories are packed as rectangles containing their own recursively packed children.

**Inputs**: Array of `FileNode` children for each directory, each with a computed `totalSize`.
**Outputs**: `Map<string, LayoutEntry>` with positions and platform sizes.

**Success criteria**:
- SC-F3-1: All files within a directory are positioned inside its platform bounds.
- SC-F3-2: No two file positions overlap (collider half-extents do not intersect at spawn).
- SC-F3-3: All subdirectory platforms are positioned inside their parent's platform bounds.
- SC-F3-4: The root-level layout contains all top-level files and directories.
- SC-F3-5: Aspect ratios of packed rectangles stay below 4:1 for any item above 1% of parent size.

### F4: Visual Directory Containment

**What it does**: Directories render as raised-edge containers (low walls or recessed trays) so the user can see that children are "inside" them. Depth is communicated by Y elevation: each nesting level places its platform slightly above its parent.

**Inputs**: `LayoutEntry` with position and `platformSize`, nesting depth.
**Outputs**: 3D mesh for each directory with visible boundary walls.

**Success criteria**:
- SC-F4-1: A user looking top-down can identify which files belong to which directory by the visible boundary.
- SC-F4-2: Nested directories (depth 2) are visually above depth 1 directories.
- SC-F4-3: Directory names are visible as labels at the edge of each container.

### F5: Cross-Directory Drag (Filesystem Move)

**What it does**: A user drags a file from one directory container and drops it into another. On release, Dax calls `fs:moveFile` to move the file on disk. The file watcher picks up the resulting `unlink`+`add` events and the tree updates.

**Inputs**: Pointer drag start (on selected file), pointer drag end (over a directory platform).
**Outputs**: `fs:moveFile` IPC call. On success, file disappears from source directory and appears in target. On failure, file snaps back to original position and a toast error appears.

**Success criteria**:
- SC-F5-1: Dragging a file from directory A to directory B results in `fs.rename(oldPath, newPath)`.
- SC-F5-2: The file's visual position smoothly animates from drag-release point to its new packed position after the watcher event arrives.
- SC-F5-3: If `fs:moveFile` throws (e.g., permission denied, name collision), the file returns to its original position and a toast displays the error.
- SC-F5-4: During drag, the file floats above platforms (Y offset +1.0 from drag plane).
- SC-F5-5: The target directory highlights when the pointer is over it during a drag.

### F6: Drop Target Detection

**What it does**: While dragging, Dax continuously raycasts downward from the dragged file's XZ position to determine which directory platform the pointer is over. This directory is visually highlighted and used as the drop target on release.

**Inputs**: Pointer position projected to XZ, directory platform colliders.
**Outputs**: `hoveredDirectoryId: string | null` in the drag store.

**Success criteria**:
- SC-F6-1: Hovering over a directory platform during drag causes its border color to change to `theme.colors.accentPrimary`.
- SC-F6-2: Nested directories: hovering over a child directory highlights the child, not the parent, even though the pointer is geometrically inside both.
- SC-F6-3: Dropping on empty space (no directory) cancels the move and snaps files back.

### F7: Labels on Hover

**What it does**: Hovering over a file shows an HTML tooltip with the file name, size, and last modified date. This is the existing behavior preserved unchanged.

**Inputs**: Pointer over InstancedMesh instance.
**Outputs**: `<Html>` tooltip anchored above the hovered card.

**Success criteria**:
- SC-F7-1: Hovering shows name, human-readable size, and date.
- SC-F7-2: Label disappears when pointer leaves the card.
- SC-F7-3: Labels are suppressed during drag operations.

### F8: Click and Selection

**What it does**: Clicking a file selects it (existing behavior). Shift-click toggles multi-select. Double-click opens externally. Right-click opens context menu. All existing selection mechanics preserved.

**Inputs**: Pointer events on InstancedMesh.
**Outputs**: `selectionStore.selectedIds` updated.

**Success criteria**:
- SC-F8-1: Single click selects one file, deselecting others.
- SC-F8-2: Shift-click adds/removes from selection.
- SC-F8-3: Double-click calls `openExternal`.
- SC-F8-4: Right-click shows context menu at pointer position.

### F9: Layout Recomputation on File Changes

**What it does**: When the file watcher reports additions, deletions, or size changes, the layout recomputes. New files appear inside their parent directory's packed region.

**Inputs**: `FileChangeEvent` from watcher.
**Outputs**: Updated `Map<string, LayoutEntry>`, re-rendered scene.

**Success criteria**:
- SC-F9-1: Adding a file to a watched directory causes it to appear inside the correct container within 2 seconds.
- SC-F9-2: Deleting a file causes it to disappear and siblings to repack.
- SC-F9-3: Changing a file's size (save larger content) adjusts its visual scale and may adjust sibling positions.

---

## 2. User Flows

### UF1: Initial Load

1. User opens a folder via the Open Folder dialog.
2. `readDirectory` IPC returns the file tree (max depth 2).
3. `fileTreeStore` populates `nodes` and `rootChildren`.
4. `Workspace` calls `calculateLayout(tree, rootPath)`.
5. Layout algorithm computes `totalSize` for every node recursively.
6. Squarified treemap runs on root children, producing positions and sizes.
7. For each directory, treemap recurses into its children.
8. `layoutMap` is set. `mergedLayoutMap` applies any position overrides.
9. `DirectoryPlatform` components render for each directory with container meshes.
10. `FileInstances` renders all files via `InstancedRigidBodies` at their packed positions.
11. Files drop onto their platforms under gravity, settle via physics.
12. Camera intro animation plays, looking at center of root layout.

**Expected outcome**: Files are visibly contained within their parent directories. Larger files have larger cards. Directory containers are sized proportionally.

### UF2: Hover and Inspect

1. User moves pointer over a file card.
2. `FileInstances.handlePointerMove` fires, sets `hoveredIndex`.
3. `HoverLabel` renders with file name, size, date.
4. Card brightens (color multiplied by 1.5).
5. User moves pointer away.
6. `handlePointerOut` fires, label disappears, card returns to normal color.

**Expected outcome**: Tooltip appears on hover, disappears on leave. No lag visible at 60 fps.

### UF3: Select and Inspect

1. User clicks a file card.
2. `handleClick` fires, calls `select(id)`.
3. Card gets upward impulse (existing behavior).
4. Detail panel opens (if wired).
5. User shift-clicks another file.
6. Both files are now selected.

**Expected outcome**: Selection visuals (brighter color, impulse) work identically to current behavior.

### UF4: Cross-Directory Drag-Move

1. User selects one or more files in directory A.
2. User holds pointer down on a selected file, begins dragging.
3. After 5px threshold, drag activates. Camera orbit disabled.
4. Dragged files switch to kinematic, float at Y+1.0.
5. As pointer moves over directory B's platform, B's container border turns accent color.
6. User releases pointer.
7. Drop target is directory B (detected via downward raycast from dragged file position).
8. For each dragged file, Dax calls `window.electronAPI.moveFile(file.path, dirB.path + '/' + file.name)`.
9. `moveFile` succeeds. File watcher fires `unlink` on old path, `add` on new path.
10. `fileTreeStore` removes node from old parent, inserts into new parent.
11. `layoutMap` recomputes. File appears in directory B's packed layout.
12. Position override for the moved file is cleared so it adopts the packed position.

**Expected outcome**: File physically moves on disk and visually moves from container A to container B.

### UF5: Failed Cross-Directory Move

1. User drags file from directory A to directory B (steps 1-8 from UF4).
2. `moveFile` throws (permission denied, target exists, etc.).
3. File snaps back to original position in directory A (position override restored or physics body teleported).
4. Toast shows error: "Failed to move {filename}: {error message}".
5. No changes to the file tree or layout.

**Expected outcome**: Graceful recovery. No orphaned nodes, no phantom files.

### UF6: Drop on Same Directory

1. User drags a file within the same directory (start and drop both in directory A).
2. On release, Dax detects that the drop target is the same directory as the source.
3. No `moveFile` call. File gets a position override (cosmetic rearrangement only, as in current behavior).
4. Physics body returns to dynamic, settles.

**Expected outcome**: No filesystem operation. File stays in the same directory. Position override persists for the session.

### UF7: Drop on Empty Space

1. User drags a file and releases over empty space (no directory platform underneath).
2. Dax detects no valid drop target.
3. File snaps back to its original position.
4. No toast, no filesystem call.

**Expected outcome**: Cancel with no side effects.

### UF8: File Watcher Adds a File

1. User creates a file externally (e.g., `touch newfile.txt` in a terminal).
2. File watcher fires `add` event with `fileInfo`.
3. `fileTreeStore.insertNode` adds the node to the correct parent.
4. Layout recomputes. New file gets a position in its parent's treemap.
5. File card appears at the computed position, drops under gravity.

**Expected outcome**: New file appears in the correct container within 2 seconds.

### UF9: File Watcher Removes a File

1. User deletes a file externally.
2. File watcher fires `unlink` event.
3. `fileTreeStore.removeNodeFromTree` removes the node.
4. Layout recomputes. Remaining siblings repack to fill the space.
5. Siblings smoothly shift to new positions (physics bodies are teleported to new positions if they differ from current by more than 0.5 units, or simply let physics settle if the change is small).

**Expected outcome**: File disappears. Siblings adjust positions. No empty gaps linger.

### UF10: Zoom and Navigate Packed Layout

1. User scrolls to zoom out. Packed directories shrink on screen.
2. LOD system kicks in: distant files scale down, then hide, then become billboard points.
3. User clicks minimap to navigate to a specific directory.
4. Camera pans to that position.
5. User scrolls to zoom in. LOD restores full detail.

**Expected outcome**: Smooth zoom with progressive detail. No pop-in artifacts at LOD boundaries.

---

## 3. Interaction Matrix

| Feature | spatialLayout.ts | FileInstances.tsx | DirectoryPlatform.tsx | FileDragger.tsx | fileTreeStore.ts | selectionStore.ts | Workspace.tsx | types/index.ts |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| F1: Size-Proportional Files | X | X | | | | | | |
| F2: Size-Proportional Dirs | X | | X | | | | X | |
| F3: Rectangle Packing | X | | | | | | X | |
| F4: Visual Containment | | | X | | | | | |
| F5: Cross-Dir Drag Move | | | X | X | X | X | | |
| F6: Drop Target Detection | | | X | X | | | | |
| F7: Labels on Hover | | X | | | | X | | |
| F8: Click and Selection | | X | | | | X | | |
| F9: Layout on File Change | X | X | X | | X | | X | |

---

## 4. Edge Cases

### F1: Size-Proportional File Objects

- **EC-F1-1: Zero-byte file.** `sizeBytes = 0`. Expected: renders at minimum scale (0.4). Formula returns floor value.
- **EC-F1-2: Extremely large file (> 1 GB).** Expected: renders at maximum scale (2.5). Clamp prevents it from dwarfing the container.
- **EC-F1-3: All files in a directory are the same size.** Expected: all cards identical size, treemap produces equal-area rectangles (grid-like).
- **EC-F1-4: One file is 1000x larger than all siblings.** Expected: that file gets a large card clamped to max scale. Its treemap rectangle is large. Siblings are small but still visible (minimum scale 0.4, minimum treemap cell 1.5x1.5 units).

### F2: Size-Proportional Directory Containers

- **EC-F2-1: Empty directory (no children).** Expected: minimum platform 4x4 units. Visual shows empty container with directory name label.
- **EC-F2-2: Directory with one tiny file.** Expected: platform is the minimum size (4x4). File card sits centered.
- **EC-F2-3: Directory whose children are all directories (no direct files).** Expected: platform sized to contain child directory platforms. No file cards rendered directly, only nested containers.
- **EC-F2-4: Deeply nested directories at max read depth (depth 2).** Expected: deepest directories render as empty containers (their children were not read). Platform shows the directory name. No phantom children.

### F3: Rectangle Packing

- **EC-F3-1: Single file in a directory.** Expected: file occupies the full treemap area. Centered in the container.
- **EC-F3-2: Two files of identical size.** Expected: treemap splits the area into two equal halves (side-by-side or stacked, depending on container aspect ratio).
- **EC-F3-3: 500+ files in a single directory.** Expected: treemap completes in under 50 ms. Cards are small but visible at minimum scale. Zoom required for inspection.
- **EC-F3-4: Mix of files and subdirectories at root level.** Expected: both files and subdirectories are packed together. Subdirectories appear as containers with their own content. Files appear as cards.
- **EC-F3-5: File with `sizeBytes = 0` alongside large siblings.** Expected: zero-byte file gets the minimum treemap cell (1.5x1.5 units) so it remains visible. Its proportional area would be zero, but we assign a floor.

### F4: Visual Directory Containment

- **EC-F4-1: Deeply nested directories (depth 2).** Expected: Y elevation stacks 3 levels. Walls are still visible from top-down camera angle.
- **EC-F4-2: Directory platform smaller than 4x4.** Expected: clamped to 4x4 minimum. Wall height scales with depth (0.3 + depth * 0.1).
- **EC-F4-3: Container is very elongated (20:1 aspect).** Expected: treemap algorithm's squarification prevents this. If it occurs due to parent constraints, walls render correctly on all four sides.

### F5: Cross-Directory Drag Move

- **EC-F5-1: Dragging a file to a directory that already contains a file with the same name.** Expected: `fs.rename` throws EEXIST or platform-specific error. File snaps back. Toast shows "File already exists in target directory."
- **EC-F5-2: Dragging a file to its own parent directory.** Expected: same-directory drop (UF6). No filesystem call.
- **EC-F5-3: Dragging multiple files from different directories.** Expected: each file's source directory is computed individually. `moveFile` is called for each. Partial failures are handled per-file (see UF5).
- **EC-F5-4: Dragging a file to a directory at max read depth.** Expected: `moveFile` still works (it's a filesystem operation, not limited by read depth). File appears in the target directory on next watcher event.
- **EC-F5-5: Network-mounted filesystem with high latency.** Expected: the `moveFile` promise may take seconds. UI shows a brief "moving" indicator. If it times out or fails, file snaps back.
- **EC-F5-6: Dragging a file while another file watcher event is processing.** Expected: drag state is independent of watcher. Position override remains until the move resolves. No race condition because `moveFile` and watcher events are sequential per file.

### F6: Drop Target Detection

- **EC-F6-1: Pointer is over overlapping directory platforms (parent and child).** Expected: raycast hits the topmost (highest Y) platform first. Child directory is selected as drop target.
- **EC-F6-2: Pointer moves very fast, skipping over a directory.** Expected: detection runs every frame. Worst case, the highlight flickers. Drop target is computed at the moment of pointer release, not during drag.
- **EC-F6-3: All files dragged out of a directory, leaving it empty.** Expected: directory persists as an empty container. Layout recomputes to minimum size.

### F7: Labels on Hover

- **EC-F7-1: Hovering during a drag operation.** Expected: hover labels are suppressed (existing behavior in `handlePointerMove`).
- **EC-F7-2: File name is 200+ characters.** Expected: label truncates to 60 chars with ellipsis.
- **EC-F7-3: Rapidly moving pointer across many files.** Expected: only one label displayed at a time. No label stacking.

### F8: Click and Selection

- **EC-F8-1: Clicking a file inside a nested container.** Expected: click hits the InstancedMesh, not the container behind it. R3F `stopPropagation` prevents the click from reaching the platform.
- **EC-F8-2: Clicking the directory container itself (not a file).** Expected: clears selection (existing SelectionBox behavior, which fires when no InstancedMesh is hit).
- **EC-F8-3: Selecting files across multiple directories.** Expected: all selected files highlight regardless of container. Dragging them triggers per-file move to the drop target.

### F9: Layout on File Change

- **EC-F9-1: Rapid-fire file changes (e.g., `npm install` creating hundreds of files).** Expected: layout recomputation is debounced. React's `useMemo` with `[nodes, rootChildren, rootPath]` naturally coalesces rapid state updates within the same frame. Multiple Zustand `set` calls batch into one React render.
- **EC-F9-2: File added to a directory not yet loaded (beyond max read depth).** Expected: watcher fires `add`, `insertNode` finds no parent in the tree, file appears at root level as an orphan. This is an existing limitation (max depth 2).
- **EC-F9-3: File size changes but name doesn't.** Expected: `updateNode` changes `sizeBytes`, layout recomputes, card scale adjusts, treemap cell size adjusts.

---

## 5. Tech Stack Decisions

### Reuse from existing codebase

| Component | Reuse | Modification needed |
|-----------|-------|-------------------|
| `@react-three/rapier` physics | Full reuse | Collider sizes must scale with card visual size |
| `InstancedRigidBodies` | Full reuse | Instance positions change (treemap vs spiral) |
| `Html` hover tooltip | Full reuse | None |
| `fileTreeStore` | Full reuse | Add `getDirectorySize(id)` helper |
| `selectionStore` | Full reuse | None |
| `useDragStore` | Extend | Add `dropTargetDirId: string \| null`, `sourceDirectoryPaths: Map<string, string>` |
| `getFileScale` in fileClassification.ts | Replace | New formula, also returns collider half-extents |
| `calculateLayout` in spatialLayout.ts | Replace | New squarified treemap algorithm |
| `DirectoryPlatform.tsx` | Major rework | Container walls, drop target highlighting |
| `FileDragger.tsx` | Major rework | Cross-directory move logic, drop target detection |
| `FileInstances.tsx` | Moderate changes | Collider scaling, position from new layout |
| `Workspace.tsx` | Minor changes | Pass new data (directory sizes, drop handlers) |
| `fs:moveFile` IPC | Full reuse | None |
| LOD system | Full reuse | Thresholds may need tuning for denser layouts |
| Billboard points | Full reuse | None |
| Nearby labels | Full reuse | None |

### New libraries needed

**None.** The squarified treemap algorithm is ~80 lines of code. No external dependency needed. This avoids bundle bloat and version coupling for a pure-math function.

### Non-negotiable requirements

1. **Physics-based** (`@react-three/rapier`): all file cards are dynamic rigid bodies. Directories are fixed rigid bodies. Gravity applies. Cards settle onto platforms.
2. **Labels on hover**: existing `Html` tooltip from `@react-three/drei`, unchanged.
3. **Clickable**: existing pointer event handlers on `InstancedMesh`, unchanged.

---

## 6. Data Model Changes

### LayoutEntry (modified)

```typescript
// src/scene/layout/spatialLayout.ts

export interface LayoutEntry {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  platformSize?: [number, number];     // [width, depth] for directories
  /** Visual scale factor for file cards. Undefined for directories. */
  cardScale?: number;
  /** Collider half-extents [halfWidth, halfHeight, halfDepth] matching cardScale. */
  colliderHalfExtents?: [number, number, number];
  /** The directory ID this node belongs to. null for root-level items. */
  parentDirectoryId?: string | null;
  /** Total recursive size in bytes (files: own size; dirs: sum of descendants). */
  totalSizeBytes?: number;
}
```

### DragState (extended)

```typescript
// src/scene/FileDragger.tsx

interface DragState {
  isDragging: boolean;
  dragPositions: Map<string, [number, number, number]>;
  dragEndTime: number;
  /** Directory ID the pointer is currently over during a drag. null if over empty space. */
  dropTargetDirId: string | null;
  /** Map of file ID to its source directory path, recorded at drag start. */
  sourceDirectoryPaths: Map<string, string>;
}
```

### FileNode (unchanged)

No changes to `FileNode`. The `sizeBytes` field on directories currently holds the inode size (unreliable). The layout algorithm computes recursive sizes itself.

### New type: TreemapRect (internal to spatialLayout.ts)

```typescript
// Internal to spatialLayout.ts, not exported

interface TreemapRect {
  x: number;      // min X in parent-local coordinates
  z: number;      // min Z in parent-local coordinates
  width: number;  // extent along X
  depth: number;  // extent along Z
}

interface TreemapItem {
  id: string;
  type: 'file' | 'directory';
  totalSize: number;         // recursive byte count
  children?: TreemapItem[];  // only for directories
  rect?: TreemapRect;        // assigned by the algorithm
}
```

---

## 7. Key Design Decisions

### 7.1 Algorithm Choice: Squarified Treemap (Rectangle Packing)

**Decision**: Use squarified treemap, not circle packing.

**Rationale**:
- Rectangle packing fills 100% of the parent area. Circle packing wastes ~21% of space in the gaps between circles. With hundreds of files, that wasted space makes directory containers much larger than necessary.
- Rectangle boundaries align with the XZ plane grid, making raycasting for drop-target detection simpler (axis-aligned bounding box test vs. circle intersection).
- Directory containers are already rectangular platforms. Nesting rectangles within rectangles is visually clean and structurally coherent.
- The squarified variant minimizes aspect ratios, preventing the thin slivers that basic slice-and-dice treemaps produce.
- Circle packing has O(n^2) complexity for force-directed variants. Squarified treemap is O(n log n) due to the sort.

The algorithm:
1. Sort children by `totalSize` descending.
2. Given a remaining rectangle, choose the shorter side.
3. Add items to a row along that shorter side until the worst aspect ratio in the row starts increasing.
4. Fix the row, slice off its area, recurse on the remaining rectangle.

### 7.2 File/Directory Size to Visual Size

**File card scale formula** (replaces `getFileScale`):

```typescript
function getFileScale(sizeBytes: number): number {
  if (sizeBytes <= 0) return 0.4;
  const log = Math.log10(Math.max(sizeBytes, 1));
  // Map log range [0, 10] to [0.4, 2.5]
  const t = log / 10;
  const scale = 0.4 + t * 2.1;
  return Math.max(0.4, Math.min(2.5, scale));
}
```

Reference points:
- 0 B: 0.4
- 100 B: 0.82
- 1 KB: 1.03
- 10 KB: 1.24
- 100 KB: 1.45
- 1 MB: 1.66
- 10 MB: 1.87
- 100 MB: 2.08
- 1 GB: 2.29

**Collider half-extents** scale with the card:

```typescript
function getColliderHalfExtents(scale: number): [number, number, number] {
  // Base card is 0.8 x 1.1 x 0.03, so half-extents are 0.4 x 0.55 x 0.015
  return [0.4 * scale, 0.55 * scale, 0.015 * scale];
}
```

This fixes the existing bug where colliders don't match visual size.

**Treemap cell area** for files:

```typescript
// In the treemap algorithm, each file's "size" input is its sizeBytes.
// Zero-byte files get a floor of MIN_FILE_SIZE_BYTES = 100 to ensure visibility.
const effectiveSize = Math.max(file.sizeBytes, 100);
```

**Directory total size**:

```typescript
function computeTotalSize(node: FileNode): number {
  if (node.type === 'file') return Math.max(node.sizeBytes, 100);
  if (!node.children || node.children.length === 0) return 100; // empty dir floor
  let total = 0;
  for (const child of node.children) {
    total += computeTotalSize(child);
  }
  return total;
}
```

### 7.3 Directory Visual Containment

Directories render as shallow rectangular trays:

```
Top-down view:          Side view (cross-section):

+-------------------+       ___________________
|  dir_name         |      |  |               |  |
|  +------+  +---+  |      |  |  files here   |  |  <-- wall height = 0.3 + depth * 0.1
|  | file | | f2 |  |      |__|_______________|__|
|  +------+  +---+  |      ====platform=0.2====
|  +------+         |
|  | sub/ |         |
|  | dir  |         |
|  +------+         |
+-------------------+
```

- Platform: 0.2 units thick (existing), positioned at Y = `parentY + 0.3` per depth level.
- Walls: 4 thin box meshes along each edge. Height = `0.3 + depth * 0.1`. Width = 0.05. Semi-transparent, colored by depth.
- Directory label: `Text` component positioned outside the top-left corner of the container, slightly above the wall.
- Y elevation per depth: `parentY + 0.3`. (Reduced from 4.0 to 0.3 because containers are now spatially nested, not side-by-side. Stacking them 4 units high would waste vertical space.)

Root platform sits at Y = 0. Depth 1 directories at Y = 0.3. Depth 2 at Y = 0.6.

### 7.4 XZ Packing with Y for Elevation

The treemap operates entirely in the XZ plane. Each level's Y is determined by its depth:

```
Y = BASE_Y + depth * DEPTH_Y_STEP

BASE_Y = 0.0
DEPTH_Y_STEP = 0.3
```

Files spawn at `Y = platformY + 0.5 + staggerOffset` (above the platform surface, with stagger to prevent all cards landing simultaneously). Gravity pulls them down onto the platform.

### 7.5 Cross-Directory Drag = Filesystem Move

Mechanical flow:

1. **Drag start**: Record each dragged file's current parent directory path.
   ```typescript
   function getParentPath(filePath: string): string {
     const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
     return lastSep > 0 ? filePath.substring(0, lastSep) : '';
   }
   ```

2. **During drag**: Every frame, raycast downward from the dragged file's current XZ position at Y = 100 (above everything) to Y = -100. The first directory platform collider hit identifies the candidate drop target. Store `dropTargetDirId` in `useDragStore`.

3. **On drop**:
   - If `dropTargetDirId === null`: cancel, snap back.
   - If drop target is the same directory as source: cancel, apply position override (cosmetic rearrange).
   - Otherwise: call `moveFile` for each selected file.

4. **moveFile call**:
   ```typescript
   const targetDir = nodes.get(dropTargetDirId);
   // For root-level drops, targetDir is null and we use rootPath
   const destFolder = targetDir ? targetDir.path : rootPath;
   const destPath = `${destFolder}/${file.name}`;
   await window.electronAPI.moveFile(file.path, destPath);
   ```

5. **Post-move**: Clear position overrides for moved files. The watcher will fire `unlink` (old location) and `add` (new location). The tree updates, layout recomputes, and files appear in their new containers.

### 7.6 Drop Target Detection

Use a Rapier raycast, not a geometric check. This leverages the existing physics world:

```typescript
// During drag, each frame:
const ray = new THREE.Ray(
  new THREE.Vector3(dragX, 50, dragZ),  // high above
  new THREE.Vector3(0, -1, 0),          // straight down
);

// Rapier world.castRay or use @react-three/rapier's useRapier().world
const hit = world.castRay(ray, 100, true);
if (hit) {
  const colliderHandle = hit.collider.handle;
  // Map collider handle back to directory ID
  // This requires tagging directory rigid bodies with their ID
}
```

Alternative (simpler, preferred): axis-aligned bounding box test.

For each directory, we know its `position` and `platformSize`. Test if the pointer's XZ position falls within the directory's XZ bounds. Among all matching directories, pick the one with the highest depth (deepest nesting). This is O(d) where d is the number of directories, but with max depth 2 and typically < 50 directories, it's sub-millisecond.

```typescript
function findDropTarget(
  x: number, z: number,
  directories: FileNode[],
  layoutMap: Map<string, LayoutEntry>,
  rootPath: string,
): string | null {
  let bestId: string | null = null;
  let bestDepth = -1;

  // Check root platform
  const rootEntry = layoutMap.get('__root__');
  if (rootEntry && rootEntry.platformSize) {
    const [rx, , rz] = rootEntry.position;
    const [rw, rd] = rootEntry.platformSize;
    if (x >= rx - rw/2 && x <= rx + rw/2 && z >= rz - rd/2 && z <= rz + rd/2) {
      bestId = '__root__';
      bestDepth = 0;
    }
  }

  for (const dir of directories) {
    const entry = layoutMap.get(dir.id);
    if (!entry || !entry.platformSize) continue;
    const [dx, , dz] = entry.position;
    const [dw, dd] = entry.platformSize;
    if (x >= dx - dw/2 && x <= dx + dw/2 && z >= dz - dd/2 && z <= dz + dd/2) {
      const depth = dir.path.split('/').length;
      if (depth > bestDepth) {
        bestDepth = depth;
        bestId = dir.id;
      }
    }
  }

  return bestId;
}
```

### 7.7 Root Level Layout

Root-level items (files and directories in `rootChildren`) are treated identically to items inside any directory. The root is an implicit container:

- Position: `[0, 0, 0]`
- Size: computed from `totalSize` of all root children
- Platform: `__root__` entry in the layout map (already exists)

The treemap algorithm treats root children as the first-level items. Root-level files and root-level directories compete for area in the same treemap, just like children within any subdirectory.

---

## 8. Non-Obvious Requirements

### 8.1 Error Handling for Failed Moves

When `moveFile` fails:
- The dragged file's rigid body is teleported back to its original position (stored at drag start).
- The body type is restored to dynamic.
- A toast notification appears via `useToast().showToast(message, 'error')`.
- Error messages are parsed: `EACCES` / `EPERM` maps to "Permission denied". `EEXIST` maps to "File already exists in target". All others show the raw error.
- If moving multiple files and some succeed, some fail: each is handled independently. Successes stay moved. Failures snap back. Toast reports "Moved N files, M failed".

### 8.2 Performance with 1000+ Files

The squarified treemap is O(n log n) for the sort, O(n) for the layout pass. For 1000 files, this completes in < 10 ms.

Rendering concerns:
- All files still use a single `InstancedMesh`. No change to draw call count (still 1).
- Collider scaling: `InstancedRigidBodies` already supports per-instance transforms. Collider half-extents differ per instance, which requires removing the shared `colliderNodes` and instead computing per-body colliders. The `@react-three/rapier` `InstancedRigidBodies` component supports `colliders="cuboid"` with per-instance scales.

    Wait: the current code uses `colliders={false}` with a shared `colliderNodes`. For per-instance collider sizes, we need to switch to dynamically creating colliders. The approach: set each instance's scale in the `instances` prop, and use `colliders="cuboid"`. Rapier will auto-generate cuboid colliders from the instance's bounding box, which scales with the instance transform.

    Alternatively, keep `colliders={false}` and use the `colliderNodes` array with per-instance overrides. The `@react-three/rapier` API doesn't directly support this. Best approach: apply the card scale to the instance `scale` field, which scales both mesh and collider:

    ```typescript
    instances = files.map((file, index) => ({
      key: file.id,
      position: [...],
      rotation: [...],
      scale: [scale, scale, scale],  // uniform scale
    }));
    ```

    With `colliders="cuboid"`, Rapier auto-computes colliders from the scaled geometry. This replaces the manual `CuboidCollider` with fixed args.

    Performance note: 1000 rigid bodies is within Rapier's comfortable range. The LOD body-type switching (freeze distant bodies to Fixed) keeps the active simulation under ~200 bodies for typical camera positions.

- Label throttling: the existing `LABEL_UPDATE_INTERVAL = 10` frames and `MAX_LABELS = 50` cap remain sufficient.

### 8.3 Visual Feedback During Cross-Directory Drag

During drag:
- **Dragged files**: kinematic bodies, elevated Y+1.0 above the drag plane, semi-transparent (opacity 0.7 via color multiplier on the instanced mesh).
- **Drop target directory**: container wall color transitions to `theme.colors.accentPrimary` with increased opacity (0.6 from default 0.3). Glow effect via emissive on the wall material.
- **Source directory**: no change (files have been "picked up", their absence is visible).
- **Invalid drop zones**: no highlight. The absence of highlight signals "dropping here does nothing."

Implementation: `DirectoryPlatform` reads `useDragStore((s) => s.dropTargetDirId)` and compares to its own directory ID. If matched, applies the highlight style. Uses `getState()` in `useFrame` to avoid re-renders.

### 8.4 Newly Added Files (Watcher) Positioning

When a watcher `add` event arrives:
1. `insertNode` adds the node to the tree.
2. Zustand's state change triggers `useMemo` in `Workspace`, recomputing the layout.
3. The new file gets a treemap position inside its parent directory.
4. The `InstancedRigidBodies` component re-renders with the updated `instances` array (new length).
5. The new file spawns at its treemap position + stagger Y offset, drops under gravity.

No special animation. The file simply appears and drops. This matches the current behavior and keeps the implementation simple.

### 8.5 Empty Directories

An empty directory renders as:
- Minimum platform 4x4 units.
- Container walls (4 thin boxes) around the perimeter.
- Directory name label at the top edge.
- Slightly muted opacity (0.5 instead of 0.85) to signal emptiness.
- A small centered text "empty" in `theme.colors.textSecondary` at 0.4 font size, optional (nice to have, not blocking).

### 8.6 Layout Transitions and Animation

When the layout recomputes (file add/remove/resize):
- **Existing files that moved**: their rigid bodies are at their old physics positions. The new layout gives them new target positions. We do NOT teleport them. Instead, we apply a gentle impulse toward their new position. The physics simulation handles the rest.

  Implementation: in `FileInstances.useFrame`, compare each body's current position to its layout position. If the distance exceeds 1.0 unit, apply a corrective force:

  ```typescript
  const dx = layoutPos[0] - bodyPos.x;
  const dz = layoutPos[2] - bodyPos.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  if (dist > 1.0) {
    const force = 2.0; // tunable
    body.applyForce({ x: dx/dist * force, y: 0, z: dz/dist * force }, true);
  }
  ```

  This creates a smooth, physics-based transition rather than jarring teleportation.

- **New files**: spawn at their treemap position with stagger, drop under gravity (existing pattern).
- **Removed files**: handled by `InstancedRigidBodies` re-render (instance count decreases, removed instances disappear).

### 8.7 File Too Large Relative to Siblings

If one file is 1 GB and siblings are all < 1 KB:
- The treemap allocates nearly all of the parent's area to the large file.
- Small siblings get the minimum cell size (1.5x1.5 units).
- The parent container expands to fit everything.
- The large file's card is clamped to max scale 2.5, so it won't be physically enormous, but its treemap cell IS proportionally large. The card sits in the center of a large cell with empty space around it.

This is correct behavior. The treemap communicates "this file dominates this directory" which is useful information.

### 8.8 Zoom and Navigation

No changes to `CameraController.tsx`. The existing RTS camera (WASD/arrow keys, right-drag pan, scroll zoom) works with any layout. The minimap recomputes from the new `layoutMap` and reflects the packed rectangles as dots.

One consideration: packed layouts are more spatially dense than the old spiral layout. The camera's `MIN_HEIGHT = 5` and `MAX_HEIGHT = 150` may need adjustment:
- Reduce `MIN_HEIGHT` to 3 to allow closer inspection of tightly packed files.
- Keep `MAX_HEIGHT` at 150 (sufficient for overview of large workspaces).

### 8.9 Search Highlighting Interaction

The existing search dimming logic in `FileInstances.useFrame` is independent of layout. Search results dim non-matching files regardless of their position. No changes needed.

One improvement: when search results are active, the minimap could highlight matching files. This is orthogonal to the tree packing feature and should be a separate ticket.

### 8.10 LOD System Adaptation

The LOD thresholds (`LOD_NEAR = 60`, `LOD_FAR = 200`, `LOD_BILLBOARD = 500`) are distance-based from the camera. With a denser layout, more files will be within the `LOD_NEAR` range at any given time.

Adjustment needed: lower `LOD_NEAR` to 40 and `LOD_FAR` to 120 for better performance with dense packing. This is a tuning parameter, not a structural change.

The LOD body-type switching (make distant bodies Fixed) becomes more important with denser layouts. The `LOD_CHECK_INTERVAL = 30` frames (~0.5 seconds at 60fps) remains appropriate.

### 8.11 Selection Box with Nested Containers

The `SelectionBox` component projects file world positions to screen space and checks point-in-rect. This works regardless of layout. Files inside nested containers are still projected correctly because their world position includes the container's offset.

One edge case: selection box drawn over a container might select files inside it that are visually occluded by the container walls. This is acceptable behavior (selection is 2D screen-space, not 3D visibility). Users can always inspect what they selected via the detail panel or shift-click to deselect.

### 8.12 Agent Entity Navigation

The agent entity (`AgentEntity.tsx`) uses `moveTo(position)` to fly to a target file's world position. The file's position comes from the layout map. With the new treemap layout, positions are different but the agent's lerp-based movement works identically.

One consideration: the agent's idle orbit uses `IDLE_ORBIT_RADIUS = 3`. With denser packing, a 3-unit orbit might clip through files. Reduce to `IDLE_ORBIT_RADIUS = 2` or make it dynamic based on nearby file density. This is a tuning concern, not a blocking issue.

The agent's `moveTo` target is the file's layout position plus Y offset. Since files are now on platforms at various Y levels, the agent correctly flies to the right altitude because it reads the file's world-space position from the layout map.

### 8.13 Position Override Semantics Change

Currently, position overrides are cosmetic (intra-directory drag). With cross-directory drag, a successful move clears the override for the moved file (it gets a new position from the layout recomputation after the watcher events).

For intra-directory drag (same source and target), the existing behavior is preserved: the override persists for the session, and the file stays where the user dropped it within the same container.

### 8.14 readDirectory Max Depth Limitation

The current `maxDepth = 2` means the tree has at most 3 levels (root, depth 1, depth 2). Depth 2 directories have `children = []` even if they contain files on disk. The treemap handles this correctly: empty directories get minimum size.

This is a known limitation. Increasing `maxDepth` is a separate concern. The tree packing layout works at any depth.

### 8.15 Collider Scaling Strategy

The current code uses `colliders={false}` with a shared `colliderNodes={[<CuboidCollider args={[0.4, 0.55, 0.015]} />]}`, which gives every file the same collider regardless of visual size. This must change.

**Decision**: Keep `colliders={false}` and the shared `colliderNodes` pattern, but set `scale: [s, s, s]` on each entry in the `instances` array, where `s = getFileScale(file.sizeBytes)`. The `CuboidCollider` base half-extents `[0.4, 0.55, 0.015]` are scaled by the instance transform automatically, giving correctly sized colliders per file.

The key insight: `InstancedRigidBodies` instances define the rigid body transform (including scale for colliders), while the visual `InstancedMesh` matrix is set independently every frame in `useFrame`. They don't interfere.

In `useFrame`, the visual matrix scale becomes `s * lodFactor * hoverMultiplier` (where `s` is the file's base scale). The collider stays fixed at scale `s`, the visual changes per frame for LOD and hover effects. Position and rotation are read from the physics body as before.

```typescript
// instances array (drives rigid body + collider):
instances = files.map((file, index) => {
  const layout = layoutMap.get(file.id);
  const pos = layout?.position ?? [0, 0.5, 0];
  const scale = getFileScale(file.sizeBytes);
  return {
    key: file.id,
    position: [pos[0], pos[1] + index * 0.5, pos[2]],
    rotation: [0, layout?.rotationY ?? 0, 0],
    scale: [scale, scale, scale],
  };
});

// useFrame visual scale (drives InstancedMesh matrix):
const baseScale = getFileScale(file.sizeBytes);
const visualScale = baseScale * lodFactor * (isHovered ? 1.15 : 1.0);
_tempObject.scale.setScalar(visualScale);
```

This fixes the collider sizing bug (SC-F1-3) without abandoning the efficient `InstancedRigidBodies` pattern.
