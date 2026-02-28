import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useCameraFocusStore } from '@/scene/CameraController';
import type { LayoutEntry } from '@/scene/layout/spatialLayout';
import { getDirAABB } from '@/scene/layout/directoryAABB';
import type { RapierRigidBody } from '@react-three/rapier';
import type { FileNode } from '@/types';
import { useToastStore } from '@/ui/Toast';

// ── Drag state store ───────────────────────────────────
// Read via getState() in animation loops for zero re-render overhead.

interface DragState {
  /** Whether a drag is currently in progress. */
  isDragging: boolean;
  /** Transient positions of files being dragged (cleared after commit). */
  dragPositions: Map<string, [number, number, number]>;
  /** Timestamp of the last drag completion (used to suppress post-drag clicks). */
  dragEndTime: number;
  /** Directory ID the pointer is currently over during a drag. null if over empty space. */
  dropTargetDirId: string | null;
  /** Map of file ID to its source directory path, recorded at drag start. */
  sourceDirectoryPaths: Map<string, string>;
}

export const useDragStore = create<DragState>(() => ({
  isDragging: false,
  dragPositions: new Map(),
  dragEndTime: 0,
  dropTargetDirId: null,
  sourceDirectoryPaths: new Map(),
}));

// ── Constants ──────────────────────────────────────────

/** Minimum pixel distance before a click becomes a drag. */
const DRAG_THRESHOLD = 5;

/** Physics constants matching InstancedRigidBodies config in FileInstances.tsx */
const NORMAL_RESTITUTION = 0.15;
const NORMAL_FRICTION = 3.0;

/** Drag collider overrides: zero bounce, high friction for gentle pushing */
const DRAG_RESTITUTION = 0.0;
const DRAG_FRICTION = 5.0;

// ── Reusable temp objects (avoid GC pressure) ──────────

const _ndc = new THREE.Vector2();
const _intersect = new THREE.Vector3();

// ── Helpers ────────────────────────────────────────────

/**
 * AABB hit-test against directory platforms and the root platform.
 * Returns the ID of the deepest (most nested) directory whose platform
 * contains the given XZ point, or '__root__' if only the root platform
 * matches, or null if no platform is hit.
 */
function findDropTarget(
  x: number,
  z: number,
  directories: FileNode[],
  layoutMap: Map<string, LayoutEntry>,
  _rootPath: string | null,
): string | null {
  let bestId: string | null = null;
  let bestDepth = -1;

  // Check root platform
  const rootEntry = layoutMap.get('__root__');
  if (rootEntry?.platformSize) {
    const [rx, , rz] = rootEntry.position;
    const [rw, rd] = rootEntry.platformSize;
    if (x >= rx - rw / 2 && x <= rx + rw / 2 && z >= rz - rd / 2 && z <= rz + rd / 2) {
      bestId = '__root__';
      bestDepth = 0;
    }
  }

  for (const dir of directories) {
    const entry = layoutMap.get(dir.id);
    if (!entry?.platformSize) continue;
    const [dx, , dz] = entry.position;
    const [dw, dd] = entry.platformSize;
    if (x >= dx - dw / 2 && x <= dx + dw / 2 && z >= dz - dd / 2 && z <= dz + dd / 2) {
      const depth = dir.path.split('/').length;
      if (depth > bestDepth) {
        bestDepth = depth;
        bestId = dir.id;
      }
    }
  }

  return bestId;
}

/** Extract the parent directory path from a full file path. */
function getParentPath(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep > 0 ? filePath.substring(0, lastSep) : '';
}

/** Parse a filesystem move error into a user-friendly message. */
function parseErrorMessage(err: unknown, fileName: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/EACCES|EPERM|permission denied/i.test(msg)) {
    return `Permission denied moving "${fileName}"`;
  }
  if (/EEXIST/i.test(msg)) {
    return `File "${fileName}" already exists in target directory`;
  }
  return `Failed to move "${fileName}": ${msg}`;
}

// ── Component ──────────────────────────────────────────

interface FileDraggerProps {
  layoutMap: Map<string, LayoutEntry>;
  rigidBodyRef: React.RefObject<(RapierRigidBody | null)[] | null>;
  fileIdToIndex: Map<string, number>;
  directories: FileNode[];
  rootPath: string | null;
}

/**
 * Invisible controller that lets users drag already-selected files
 * to new positions on the XZ plane. Supports cross-directory drag & drop
 * with filesystem move. Commits position overrides to the file-tree store
 * on release within the same directory, or calls moveFile for cross-directory drops.
 */
export default function FileDragger({
  layoutMap,
  rigidBodyRef,
  fileIdToIndex,
  directories,
  rootPath,
}: FileDraggerProps) {
  const { gl, camera, scene, raycaster } = useThree();

  // Drag tracking refs — mutated during pointer events, no React renders
  const potentialDrag = useRef(false);
  const dragActive = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragStartHit = useRef(new THREE.Vector3());
  const initialPositions = useRef(new Map<string, [number, number, number]>());

  // Physics-drag refs
  const draggedIdsRef = useRef<string[] | null>(null);
  const dragStartYRef = useRef<Map<string, number>>(new Map());

  // Active directory AABB used to clamp kinematic drag position to fence walls
  const activeDirAABBRef = useRef<{ minX: number; maxX: number; minZ: number; maxZ: number } | null>(null);

  // Source directory paths for each dragged file (recorded at drag start)
  const sourceDirectoryPathsRef = useRef<Map<string, string>>(new Map());

  // Keep layoutMap ref fresh so event closures always see the latest value
  const layoutRef = useRef(layoutMap);
  layoutRef.current = layoutMap;

  // Keep fileIdToIndex ref fresh so event closures always see the latest value
  const fileIdToIndexRef = useRef(fileIdToIndex);
  fileIdToIndexRef.current = fileIdToIndex;

  // Keep directories and rootPath refs fresh for closures
  const directoriesRef = useRef(directories);
  directoriesRef.current = directories;
  const rootPathRef = useRef(rootPath);
  rootPathRef.current = rootPath;

  useEffect(() => {
    const canvas = gl.domElement;

    /** Compute NDC from a pointer event relative to the canvas. */
    const getNDC = (e: PointerEvent): THREE.Vector2 => {
      const rect = canvas.getBoundingClientRect();
      _ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      return _ndc;
    };

    /** Raycast pointer against the drag ground plane. */
    const hitGroundPlane = (e: PointerEvent): THREE.Vector3 | null => {
      raycaster.setFromCamera(getNDC(e), camera);
      return raycaster.ray.intersectPlane(dragPlane.current, _intersect);
    };

    // ── Pointer handlers ─────────────────────────────────

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // Raycast into scene to find an instanced-mesh hit
      raycaster.setFromCamera(getNDC(e), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const hit = intersects.find(
        (i) =>
          i.object instanceof THREE.InstancedMesh &&
          i.instanceId !== undefined,
      );
      if (!hit || hit.instanceId === undefined) return;

      // Map (mesh, instanceId) → fileId via userData set by FileInstances
      const fileIds = (hit.object as THREE.InstancedMesh).userData
        .fileIds as string[] | undefined;
      if (!fileIds) return;
      const fileId = fileIds[hit.instanceId];
      if (!fileId) return;

      // If the hit file isn't in the current selection, select it exclusively
      // so a single mousedown-drag works without a prior click.
      const selectionStore = useSelectionStore.getState();
      let selectedIds = selectionStore.selectedIds;
      if (!selectedIds.has(fileId)) {
        selectionStore.select(fileId);
        selectedIds = new Set([fileId]);
      }

      // Determine ground-plane Y from the file's actual physics body position
      const layout = layoutRef.current;
      const clickedIndex = fileIdToIndexRef.current.get(fileId);
      const clickedBody = clickedIndex !== undefined ? rigidBodyRef.current?.[clickedIndex] : undefined;
      const filePos: [number, number, number] = clickedBody
        ? [clickedBody.translation().x, clickedBody.translation().y, clickedBody.translation().z]
        : layout.get(fileId)?.position ?? [0, 0, 0];
      dragPlane.current.set(new THREE.Vector3(0, 1, 0), -filePos[1]);

      // Compute the ground-plane intersection at the click point
      const startHit = raycaster.ray.intersectPlane(
        dragPlane.current,
        _intersect,
      );
      if (!startHit) return;
      dragStartHit.current.copy(startHit);

      // Record initial positions of ALL selected files from their physics bodies
      const initMap = new Map<string, [number, number, number]>();
      for (const id of selectedIds) {
        const idx = fileIdToIndexRef.current.get(id);
        const body = idx !== undefined ? rigidBodyRef.current?.[idx] : undefined;
        if (body) {
          const t = body.translation();
          initMap.set(id, [t.x, t.y, t.z]);
        } else {
          const entry = layout.get(id);
          const p = entry?.position ?? [0, 0, 0];
          initMap.set(id, [p[0], p[1], p[2]]);
        }
      }
      initialPositions.current = initMap;

      // Record source directory paths for each dragged file
      const srcDirPaths = new Map<string, string>();
      const nodes = useFileTreeStore.getState().nodes;
      for (const id of selectedIds) {
        const node = nodes.get(id);
        if (node) {
          srcDirPaths.set(id, getParentPath(node.path));
        }
      }
      sourceDirectoryPathsRef.current = srcDirPaths;

      // Switch dragged bodies to kinematic so pointer controls them
      const draggedIds = Array.from(selectedIds);
      draggedIdsRef.current = draggedIds;
      dragStartYRef.current = new Map();

      // Initialise the active-directory AABB for wall clamping during drag
      const sourceDirId = findDropTarget(
        filePos[0], filePos[2],
        directoriesRef.current, layoutRef.current, rootPathRef.current,
      ) ?? '__root__';
      activeDirAABBRef.current = getDirAABB(sourceDirId, layoutRef.current);

      potentialDrag.current = true;
      dragActive.current = false;
      startMouse.current = { x: e.clientX, y: e.clientY };

      // Switch bodies to kinematic and soften colliders (after potentialDrag is set
      // so drag still works even if collider API throws)
      draggedIds.forEach(id => {
        const index = fileIdToIndexRef.current.get(id);
        const body = index !== undefined ? rigidBodyRef.current?.[index] : undefined;
        if (body) {
          body.setBodyType(2, true); // 2 = KinematicPositionBased, wake
          const t = body.translation();
          dragStartYRef.current.set(id, t.y);

          try {
            for (let c = 0; c < body.numColliders(); c++) {
              const collider = body.collider(c);
              collider.setRestitution(DRAG_RESTITUTION);
              collider.setFriction(DRAG_FRICTION);
            }
          } catch { /* collider API unavailable — drag still works without softening */ }
        }
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!potentialDrag.current) return;

      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;

      // Activate drag once the pixel threshold is exceeded
      if (!dragActive.current) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        dragActive.current = true;
        useDragStore.setState({ isDragging: true });
        useCameraFocusStore.getState().setOrbitEnabled(false);
      }

      // Raycast current pointer against the ground plane
      const current = hitGroundPlane(e);
      if (!current) return;

      const deltaX = current.x - dragStartHit.current.x;
      const deltaZ = current.z - dragStartHit.current.z;

      // Compute raw new positions (unclamped)
      const rawPositions = new Map<string, [number, number, number]>();
      for (const [id, initPos] of initialPositions.current) {
        rawPositions.set(id, [initPos[0] + deltaX, initPos[1], initPos[2] + deltaZ]);
      }

      // Determine drop target from the primary file's raw XZ
      let newDropTarget: string | null = null;
      if (draggedIdsRef.current?.length) {
        const primaryRaw = rawPositions.get(draggedIdsRef.current[0]);
        if (primaryRaw) {
          newDropTarget = findDropTarget(
            primaryRaw[0], primaryRaw[2],
            directoriesRef.current, layoutRef.current, rootPathRef.current,
          );
        }
      }

      // When cursor enters a new valid directory, switch the active clamping AABB
      if (newDropTarget !== null) {
        const newAABB = getDirAABB(newDropTarget, layoutRef.current);
        if (newAABB) activeDirAABBRef.current = newAABB;
      }

      // Clamp each file's position to the active directory AABB (fence walls)
      const aabb = activeDirAABBRef.current;
      const newPositions = new Map<string, [number, number, number]>();
      for (const [id, [rx, ry, rz]] of rawPositions) {
        newPositions.set(id, [
          aabb ? Math.max(aabb.minX, Math.min(aabb.maxX, rx)) : rx,
          ry,
          aabb ? Math.max(aabb.minZ, Math.min(aabb.maxZ, rz)) : rz,
        ]);
      }

      // Drive kinematic bodies to clamped positions at ground level
      if (draggedIdsRef.current) {
        draggedIdsRef.current.forEach(id => {
          const index = fileIdToIndexRef.current.get(id);
          const body = index !== undefined ? rigidBodyRef.current?.[index] : undefined;
          if (body) {
            const startY = dragStartYRef.current.get(id) ?? 0;
            const pos = newPositions.get(id);
            if (pos) {
              body.setNextKinematicTranslation({
                x: pos[0],
                y: startY,
                z: pos[2],
              });
            }
          }
        });
      }

      useDragStore.setState({ dragPositions: newPositions, dropTargetDirId: newDropTarget });
    };

    const onPointerUp = () => {
      if (!potentialDrag.current) return;
      potentialDrag.current = false;

      if (dragActive.current) {
        dragActive.current = false;

        const { dropTargetDirId } = useDragStore.getState();
        const store = useFileTreeStore.getState();
        const nodes = store.nodes;
        const currentRootPath = rootPathRef.current;
        const srcDirPaths = sourceDirectoryPathsRef.current;

        // Helper: restore a body to dynamic with zero velocity and normal collider props
        const restoreBody = (id: string) => {
          const index = fileIdToIndexRef.current.get(id);
          const body = index !== undefined ? rigidBodyRef.current?.[index] : undefined;
          if (body) {
            body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            body.setBodyType(0, true); // Dynamic
            try {
              for (let c = 0; c < body.numColliders(); c++) {
                const collider = body.collider(c);
                collider.setRestitution(NORMAL_RESTITUTION);
                collider.setFriction(NORMAL_FRICTION);
              }
            } catch { /* collider API unavailable */ }
          }
        };

        // Helper: snap a file back to its original position
        const snapBack = (id: string) => {
          const origPos = initialPositions.current.get(id);
          if (origPos) {
            store.setPositionOverride(id, origPos);
            const index = fileIdToIndexRef.current.get(id);
            const body = index !== undefined ? rigidBodyRef.current?.[index] : undefined;
            if (body) {
              body.setTranslation({ x: origPos[0], y: origPos[1], z: origPos[2] }, true);
            }
          }
          restoreBody(id);
        };

        const draggedIds = draggedIdsRef.current ?? [];

        if (dropTargetDirId === null) {
          // ── Drop on empty space → snap back, no-op ────────
          for (const id of draggedIds) {
            snapBack(id);
          }
        } else {
          // ── Determine the drop target directory path ──────
          let targetDirPath: string;
          if (dropTargetDirId === '__root__') {
            targetDirPath = currentRootPath ?? '';
          } else {
            const targetDirNode = nodes.get(dropTargetDirId);
            targetDirPath = targetDirNode?.path ?? '';
          }

          // Separate files into same-dir and cross-dir
          const sameDirIds: string[] = [];
          const crossDirFiles: Array<{ id: string; node: FileNode }> = [];

          for (const id of draggedIds) {
            const srcPath = srcDirPaths.get(id) ?? '';
            if (srcPath === targetDirPath) {
              sameDirIds.push(id);
            } else {
              const node = nodes.get(id);
              if (node) {
                crossDirFiles.push({ id, node });
              } else {
                // Node not found — snap back
                snapBack(id);
              }
            }
          }

          // ── Same-directory drops → position override only ──
          // Use actual body translation as the ground truth for where the card is
          for (const id of sameDirIds) {
            const idx = fileIdToIndexRef.current.get(id);
            const body = idx !== undefined ? rigidBodyRef.current?.[idx] : undefined;
            if (body) {
              const t = body.translation();
              store.setPositionOverride(id, [t.x, t.y, t.z]);
            }
            restoreBody(id);
          }

          // ── Cross-directory drops → filesystem move ────────
          if (crossDirFiles.length > 0) {
            let successCount = 0;
            let failCount = 0;
            const errors: string[] = [];

            // Execute all moves, then report
            const movePromises = crossDirFiles.map(async ({ id, node }) => {
              const destPath = `${targetDirPath}/${node.name}`;
              try {
                await window.electronAPI.moveFile(node.path, destPath);
                // Success → clear position override so layout recompute places it
                store.clearPositionOverride(id);
                restoreBody(id);
                successCount++;
              } catch (err: unknown) {
                // Failure → snap back and record error
                snapBack(id);
                failCount++;
                errors.push(parseErrorMessage(err, node.name));
              }
            });

            // Wait for all moves to complete, then show toast if any failed
            void Promise.all(movePromises).then(() => {
              if (failCount > 0) {
                const toastStore = useToastStore.getState();
                if (failCount === 1 && errors.length === 1) {
                  toastStore.addToast(errors[0], 'error');
                } else {
                  const summary = successCount > 0
                    ? `Moved ${successCount} file${successCount !== 1 ? 's' : ''}, ${failCount} failed`
                    : `Failed to move ${failCount} file${failCount !== 1 ? 's' : ''}`;
                  toastStore.addToast(summary, 'error');
                }
              }
            });
          }
        }

        draggedIdsRef.current = null;
        sourceDirectoryPathsRef.current = new Map();

        // Mark drag as finished
        useDragStore.setState({
          isDragging: false,
          dragEndTime: Date.now(),
          dropTargetDirId: null,
          sourceDirectoryPaths: new Map(),
        });

        requestAnimationFrame(() => {
          useDragStore.setState({ dragPositions: new Map() });
        });

        // Re-enable camera orbit
        useCameraFocusStore.getState().setOrbitEnabled(true);
      } else {
        // Drag was cancelled before threshold — still restore any kinematic bodies
        if (draggedIdsRef.current) {
          draggedIdsRef.current.forEach(id => {
            const index = fileIdToIndexRef.current.get(id);
            const body = index !== undefined ? rigidBodyRef.current?.[index] : undefined;
            if (body) {
              body.setLinvel({ x: 0, y: 0, z: 0 }, true);
              body.setAngvel({ x: 0, y: 0, z: 0 }, true);
              body.setBodyType(0, true);
              try {
                for (let c = 0; c < body.numColliders(); c++) {
                  const collider = body.collider(c);
                  collider.setRestitution(NORMAL_RESTITUTION);
                  collider.setFriction(NORMAL_FRICTION);
                }
              } catch { /* collider API unavailable */ }
            }
          });
          draggedIdsRef.current = null;
        }
        // Clear drop target in case it was set during micro-movement
        useDragStore.setState({ dropTargetDirId: null });
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, camera, scene, raycaster]);

  // Renders nothing — purely an event-driven controller
  return null;
}
