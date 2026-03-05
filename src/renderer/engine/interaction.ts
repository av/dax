/**
 * Interaction system — input state machine for 3D object manipulation.
 *
 * States: idle → hovering → selecting → dragging → throwing
 *
 * Controls:
 * - Left click: select (Ctrl+click for multi-select)
 * - Left click + drag: grab and drag object on XZ plane (file becomes kinematic)
 * - Release drag: throw with velocity impulse (file returns to dynamic)
 * - Double-click: open file (OS default app) or fly-to-folder
 * - Right click: context menu
 * - Hover 500ms: show tooltip
 *
 * Coordinates with camera (middle mouse = camera, left = interaction, right = context menu).
 */
import {
  Vector3,
  PhysicsMotionType,
  type Scene,
  type AbstractMesh,
  type TransformNode,
  type PointerInfo,
  PointerEventTypes,
} from '@babylonjs/core';
import { getScene } from './scene';
import { getCamera } from './camera';
import { getMeshByPath } from './mesh-factory';
import { getAggregate } from './physics';
import {
  addSelectionHighlight,
  removeSelectionHighlight,
  clearAllHighlights,
  addFolderDropHighlight,
  removeFolderDropHighlight,
  clearFolderHighlights,
  createGhostOutline,
  removeGhostOutline,
  clearAllGhosts,
} from './selection';
import {
  selectedIds,
  setSelectedIds,
  selectOne,
  addToSelection,
  toggleSelection,
  clearSelection,
} from '../state/selection';
import {
  openContextMenu,
  closeContextMenu,
  tooltip,
  setTooltip,
  isTextInputFocused,
} from '../state/ui';
import type { ContextMenuTarget } from '../state/ui';

// ── Constants ──

/** Hover tooltip delay (ms) */
const HOVER_TOOLTIP_DELAY = 500;

/** Double-click threshold (ms) */
const DOUBLE_CLICK_THRESHOLD = 300;

/** Minimum drag distance (px) to start drag mode */
const DRAG_THRESHOLD_PX = 5;

/** Maximum throw velocity (units/second) */
const MAX_THROW_VELOCITY = 50;

/** Velocity tracking sample count */
const VELOCITY_SAMPLES = 5;

// ── State Machine ──

type InteractionState = 'idle' | 'hovering' | 'down' | 'dragging';

let currentState: InteractionState = 'idle';
let hoveredMesh: AbstractMesh | null = null;
let draggedNode: TransformNode | null = null;
let dragStartScreenX = 0;
let dragStartScreenY = 0;
let lastScreenX = 0;
let lastScreenY = 0;
let pointerDownTime = 0;
let lastClickTime = 0;
let lastClickMeshId: string | null = null;

/** Hover tooltip timer */
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

/** Velocity sampling for throw */
const velocitySamples: Array<{ dx: number; dz: number; dt: number }> = [];
let lastDragTime = 0;
let lastDragWorldX = 0;
let lastDragWorldZ = 0;

/** Drop target folder currently highlighted */
let dropTargetMesh: AbstractMesh | null = null;

/** Observer reference for cleanup */
let pointerObserver: ReturnType<Scene['onPointerObservable']['add']> | null = null;

/**
 * Initialize the interaction system.
 * Registers pointer event listeners on the Babylon.js scene.
 */
export function initInteractionSystem(scene: Scene): void {
  pointerObserver = scene.onPointerObservable.add((info: PointerInfo) => {
    // Don't process interactions when text input overlay is focused
    if (isTextInputFocused()) return;

    switch (info.type) {
      case PointerEventTypes.POINTERDOWN:
        onPointerDown(info, scene);
        break;
      case PointerEventTypes.POINTERMOVE:
        onPointerMove(info, scene);
        break;
      case PointerEventTypes.POINTERUP:
        onPointerUp(info, scene);
        break;
    }
  });
}

// ── Event Handlers ──

function onPointerDown(info: PointerInfo, scene: Scene): void {
  const evt = info.event as PointerEvent;

  // Only handle left button (0) or right button (2)
  if (evt.button !== 0 && evt.button !== 2) return;

  // Right click → context menu
  if (evt.button === 2) {
    handleRightClick(info, scene, evt);
    return;
  }

  // Left click — start potential selection or drag
  const pick = scene.pick(scene.pointerX, scene.pointerY);
  const mesh = pick?.hit ? findInteractableMesh(pick.pickedMesh) : null;

  dragStartScreenX = evt.clientX;
  dragStartScreenY = evt.clientY;
  lastScreenX = evt.clientX;
  lastScreenY = evt.clientY;
  pointerDownTime = performance.now();

  if (mesh) {
    const path = getPathFromMesh(mesh);
    if (path) {
      currentState = 'down';
      hoveredMesh = mesh;
    }
  } else {
    // Clicked on empty space
    currentState = 'down';
    hoveredMesh = null;
  }
}

function onPointerMove(info: PointerInfo, scene: Scene): void {
  const evt = info.event as PointerEvent;

  if (currentState === 'down') {
    // Check if we've exceeded drag threshold
    const dx = evt.clientX - dragStartScreenX;
    const dy = evt.clientY - dragStartScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= DRAG_THRESHOLD_PX && hoveredMesh) {
      startDrag(hoveredMesh, scene, evt);
    }
    lastScreenX = evt.clientX;
    lastScreenY = evt.clientY;
    return;
  }

  if (currentState === 'dragging') {
    updateDrag(scene, evt);
    lastScreenX = evt.clientX;
    lastScreenY = evt.clientY;
    return;
  }

  // Idle/hovering — check for hover target
  const pick = scene.pick(scene.pointerX, scene.pointerY);
  const mesh = pick?.hit ? findInteractableMesh(pick.pickedMesh) : null;

  if (mesh !== hoveredMesh) {
    // Hover changed
    clearHoverTimer();
    if (mesh) {
      hoveredMesh = mesh;
      currentState = 'hovering';
      startHoverTimer(mesh, evt);
    } else {
      hoveredMesh = null;
      currentState = 'idle';
      hideTooltip();
    }
  }

  lastScreenX = evt.clientX;
  lastScreenY = evt.clientY;
}

function onPointerUp(info: PointerInfo, scene: Scene): void {
  const evt = info.event as PointerEvent;

  if (evt.button !== 0) return;

  if (currentState === 'dragging') {
    endDrag(scene);
    return;
  }

  if (currentState === 'down') {
    // This was a click (no drag)
    handleClick(info, scene, evt);
  }

  currentState = hoveredMesh ? 'hovering' : 'idle';
}

// ── Click Handling ──

function handleClick(info: PointerInfo, scene: Scene, evt: PointerEvent): void {
  closeContextMenu();
  hideTooltip();

  const pick = scene.pick(scene.pointerX, scene.pointerY);
  const mesh = pick?.hit ? findInteractableMesh(pick.pickedMesh) : null;

  if (!mesh) {
    // Clicked empty space — clear selection
    clearSelection();
    clearAllHighlights();
    return;
  }

  const path = getPathFromMesh(mesh);
  if (!path) return;

  const now = performance.now();

  // Check for double-click
  if (
    lastClickMeshId === mesh.name &&
    now - lastClickTime < DOUBLE_CLICK_THRESHOLD
  ) {
    handleDoubleClick(mesh, path);
    lastClickTime = 0;
    lastClickMeshId = null;
    return;
  }

  lastClickTime = now;
  lastClickMeshId = mesh.name;

  // Single click selection
  if (evt.shiftKey || evt.ctrlKey || evt.metaKey) {
    // Multi-select toggle
    toggleSelection(path);
    if (selectedIds().has(path)) {
      addSelectionHighlight(mesh);
    } else {
      removeSelectionHighlight(mesh);
    }
  } else {
    // Single select
    clearAllHighlights();
    selectOne(path);
    addSelectionHighlight(mesh);
  }
}

function handleDoubleClick(mesh: AbstractMesh, path: string): void {
  const meta = getMeshMetadata(mesh);
  if (!meta) return;

  if (meta.type === 'folder') {
    // Double-click folder — fly camera to folder position
    flyToMesh(mesh);
  } else {
    // Double-click file — open with OS default app
    // Dispatch custom event that the GUI layer will handle
    window.dispatchEvent(
      new CustomEvent('dax:open-file', { detail: { path } }),
    );
  }
}

function handleRightClick(info: PointerInfo, scene: Scene, evt: PointerEvent): void {
  evt.preventDefault();
  hideTooltip();

  const pick = scene.pick(scene.pointerX, scene.pointerY);
  const mesh = pick?.hit ? findInteractableMesh(pick.pickedMesh) : null;

  let target: ContextMenuTarget;

  if (!mesh) {
    target = { type: 'empty' };
  } else {
    const meta = getMeshMetadata(mesh);
    const path = getPathFromMesh(mesh);

    if (meta && path) {
      if (meta.type === 'folder') {
        target = { type: 'folder', path, absPath: meta.absPath ?? path };
      } else {
        target = { type: 'file', path, absPath: meta.absPath ?? path };
      }

      // Also select the right-clicked object if not already selected
      if (!selectedIds().has(path)) {
        clearAllHighlights();
        selectOne(path);
        addSelectionHighlight(mesh);
      }
    } else {
      target = { type: 'empty' };
    }
  }

  openContextMenu(evt.clientX, evt.clientY, target);
}

// ── Drag System ──

function startDrag(mesh: AbstractMesh, scene: Scene, evt: PointerEvent): void {
  const path = getPathFromMesh(mesh);
  if (!path) return;

  // Find the root transform node
  const root = getMeshByPath(path);
  if (!root) return;

  // Don't allow dragging folders (they are fixed containers)
  const meta = getMeshMetadata(mesh);
  if (meta?.type === 'folder') return;

  currentState = 'dragging';
  draggedNode = root;

  // Select if not already selected
  if (!selectedIds().has(path)) {
    clearAllHighlights();
    selectOne(path);
    addSelectionHighlight(mesh);
  }

  // Create ghost outline at original position
  createGhostOutline(root, scene);

  // Switch physics to kinematic for smooth dragging
  const agg = getAggregate(mesh.name);
  if (agg?.body) {
    agg.body.setMotionType(PhysicsMotionType.ANIMATED);
    agg.body.setLinearVelocity(Vector3.Zero());
    agg.body.setAngularVelocity(Vector3.Zero());
  }

  // Initialize velocity tracking
  velocitySamples.length = 0;
  lastDragTime = performance.now();
  lastDragWorldX = root.position.x;
  lastDragWorldZ = root.position.z;

  // Lift the object slightly
  root.position.y += 1.0;
}

function updateDrag(scene: Scene, evt: PointerEvent): void {
  if (!draggedNode) return;

  const camera = getCamera();
  if (!camera) return;

  // Project pointer to XZ plane at the dragged object's height
  const ray = scene.createPickingRay(
    scene.pointerX,
    scene.pointerY,
    null,
    camera,
  );

  // Intersect ray with horizontal plane at the drag height
  const dragY = draggedNode.position.y;
  if (Math.abs(ray.direction.y) < 0.001) return; // Ray parallel to plane

  const t = (dragY - ray.origin.y) / ray.direction.y;
  if (t < 0) return; // Behind camera

  const worldX = ray.origin.x + ray.direction.x * t;
  const worldZ = ray.origin.z + ray.direction.z * t;

  // Track velocity
  const now = performance.now();
  const dt = now - lastDragTime;
  if (dt > 0) {
    velocitySamples.push({
      dx: worldX - lastDragWorldX,
      dz: worldZ - lastDragWorldZ,
      dt,
    });
    if (velocitySamples.length > VELOCITY_SAMPLES) {
      velocitySamples.shift();
    }
  }
  lastDragTime = now;
  lastDragWorldX = worldX;
  lastDragWorldZ = worldZ;

  // Move the object
  draggedNode.position.x = worldX;
  draggedNode.position.z = worldZ;

  // Check for folder drop target
  checkDropTarget(scene, worldX, worldZ);
}

function endDrag(scene: Scene): void {
  if (!draggedNode) {
    currentState = 'idle';
    return;
  }

  const path = getPathFromMesh(draggedNode.getChildMeshes(true)[0]);

  // If over a folder drop target, dispatch move event
  if (dropTargetMesh && path) {
    const folderPath = getPathFromMesh(dropTargetMesh);
    if (folderPath) {
      window.dispatchEvent(
        new CustomEvent('dax:move-into-folder', {
          detail: { sourcePath: path, targetFolderPath: folderPath },
        }),
      );
    }
    clearFolderHighlights();
    dropTargetMesh = null;
  } else {
    // Throw — compute velocity and apply impulse
    applyThrowVelocity(draggedNode);
  }

  // Remove ghost outline
  removeGhostOutline(draggedNode.name);

  draggedNode = null;
  currentState = 'idle';

  // Clean up any remaining ghosts
  clearAllGhosts();
}

function applyThrowVelocity(node: TransformNode): void {
  // Compute average velocity from samples
  let totalDx = 0;
  let totalDz = 0;
  let totalDt = 0;

  for (const sample of velocitySamples) {
    totalDx += sample.dx;
    totalDz += sample.dz;
    totalDt += sample.dt;
  }

  // Get the main mesh child for physics
  const mainMesh = node.getChildMeshes(true)[0];
  if (!mainMesh) return;

  const agg = getAggregate(mainMesh.name);
  if (!agg?.body) return;

  // Switch back to dynamic
  agg.body.setMotionType(PhysicsMotionType.DYNAMIC);

  if (totalDt > 0) {
    // Convert to units/second (dt is in ms)
    let vx = (totalDx / totalDt) * 1000;
    let vz = (totalDz / totalDt) * 1000;

    // Clamp velocity
    const speed = Math.sqrt(vx * vx + vz * vz);
    if (speed > MAX_THROW_VELOCITY) {
      const scale = MAX_THROW_VELOCITY / speed;
      vx *= scale;
      vz *= scale;
    }

    agg.body.setLinearVelocity(new Vector3(vx, -2, vz));
  }

  velocitySamples.length = 0;
}

// ── Drop Target Detection ──

function checkDropTarget(scene: Scene, worldX: number, worldZ: number): void {
  // Clear previous drop target highlight
  if (dropTargetMesh) {
    removeFolderDropHighlight(dropTargetMesh);
    dropTargetMesh = null;
  }

  // Find folders near the drop position
  for (const mesh of scene.meshes) {
    if (!mesh.metadata || mesh.metadata.type !== 'folder') continue;
    if (!mesh.isPickable) continue;

    const bounds = mesh.getBoundingInfo();
    const center = bounds.boundingBox.centerWorld;
    const dx = worldX - center.x;
    const dz = worldZ - center.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Check if within folder bounds (approximate with distance)
    if (dist < 2.0) {
      dropTargetMesh = mesh;
      addFolderDropHighlight(mesh);
      return;
    }
  }
}

// ── Hover / Tooltip ──

function startHoverTimer(mesh: AbstractMesh, evt: PointerEvent): void {
  clearHoverTimer();
  hoverTimer = setTimeout(() => {
    const meta = getMeshMetadata(mesh);
    const path = getPathFromMesh(mesh);
    if (meta && path) {
      setTooltip({
        visible: true,
        x: evt.clientX + 12,
        y: evt.clientY + 12,
        name: path.split('/').pop() ?? path,
        size: '', // Will be populated asynchronously if needed
        type: meta.type === 'folder' ? 'folder' : (meta.category ?? 'file'),
      });
    }
  }, HOVER_TOOLTIP_DELAY);
}

function clearHoverTimer(): void {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

function hideTooltip(): void {
  clearHoverTimer();
  setTooltip({
    visible: false,
    x: 0,
    y: 0,
    name: '',
    size: '',
    type: '',
  });
}

// ── Camera ──

function flyToMesh(mesh: AbstractMesh): void {
  const camera = getCamera();
  if (!camera) return;

  const pos = mesh.parent
    ? (mesh.parent as TransformNode).position
    : mesh.position;

  camera.target = pos.clone();
  camera.radius = 15;
}

// ── Mesh Utilities ──

interface MeshMetadata {
  path?: string;
  type?: 'file' | 'folder';
  category?: string;
  absPath?: string;
}

/**
 * Find the interactable mesh from a picked mesh.
 * Walks up the parent chain to find a mesh with metadata.
 */
function findInteractableMesh(
  pickedMesh: AbstractMesh | null | undefined,
): AbstractMesh | null {
  if (!pickedMesh) return null;

  // Check the mesh itself
  if (pickedMesh.metadata?.path) return pickedMesh;

  // Check parent (for meshes that are children of a TransformNode)
  if (pickedMesh.parent) {
    // Check sibling meshes of the parent
    const siblings = (pickedMesh.parent as TransformNode).getChildMeshes(true);
    for (const sibling of siblings) {
      if (sibling.metadata?.path) return sibling;
    }
  }

  return null;
}

function getPathFromMesh(
  meshOrNode: AbstractMesh | TransformNode | null | undefined,
): string | null {
  if (!meshOrNode) return null;

  // Direct metadata check
  if ((meshOrNode as AbstractMesh).metadata?.path) {
    return (meshOrNode as AbstractMesh).metadata.path;
  }

  // Check children (for TransformNode roots)
  if ('getChildMeshes' in meshOrNode) {
    const children = meshOrNode.getChildMeshes(true);
    for (const child of children) {
      if (child.metadata?.path) return child.metadata.path;
    }
  }

  return null;
}

function getMeshMetadata(
  mesh: AbstractMesh | null | undefined,
): MeshMetadata | null {
  if (!mesh) return null;
  return mesh.metadata as MeshMetadata | null;
}

/**
 * Cycle selection to the next mesh (Tab key).
 * If nothing is selected, selects the first mesh. Otherwise selects the next one.
 */
export function cycleSelection(scene: Scene): void {
  const allPaths: string[] = [];
  for (const mesh of scene.meshes) {
    if (mesh.metadata?.path) {
      allPaths.push(mesh.metadata.path);
    }
  }
  if (allPaths.length === 0) return;

  allPaths.sort();

  const current = selectedIds();
  let nextIndex = 0;

  if (current.size > 0) {
    const lastSelected = Array.from(current).pop()!;
    const currentIndex = allPaths.indexOf(lastSelected);
    nextIndex = currentIndex >= 0 ? (currentIndex + 1) % allPaths.length : 0;
  }

  clearAllHighlights();
  const nextPath = allPaths[nextIndex];
  setSelectedIds(new Set([nextPath]));

  const node = getMeshByPath(nextPath);
  if (node && 'getBoundingInfo' in node) addSelectionHighlight(node as AbstractMesh);
}

/**
 * Select all visible meshes with paths (Ctrl+A).
 */
export function selectAll(scene: Scene): void {
  clearAllHighlights();
  const ids = new Set<string>();

  for (const mesh of scene.meshes) {
    if (mesh.metadata?.path) {
      ids.add(mesh.metadata.path);
      addSelectionHighlight(mesh);
    }
  }

  setSelectedIds(ids);
}

/**
 * Dispose the interaction system.
 */
export function disposeInteractionSystem(scene: Scene): void {
  if (pointerObserver) {
    scene.onPointerObservable.remove(pointerObserver);
    pointerObserver = null;
  }
  clearHoverTimer();
  hideTooltip();
  clearAllHighlights();
  clearAllGhosts();
  clearFolderHighlights();
  currentState = 'idle';
  hoveredMesh = null;
  draggedNode = null;
  dropTargetMesh = null;
}
