import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useCameraFocusStore } from '@/scene/CameraController';
import type { LayoutEntry } from '@/scene/layout/spatialLayout';
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

      // Only initiate a potential drag on already-selected files
      const { selectedIds } = useSelectionStore.getState();
      if (!selectedIds.has(fileId)) return;

      // Determine ground-plane Y from the file's current position
      const layout = layoutRef.current;
      const posOverrides = useFileTreeStore.getState().positionOverrides;
      const filePos =
        posOverrides.get(fileId) ??
        layout.get(fileId)?.position ?? [0, 0, 0];
      dragPlane.current.set(new THREE.Vector3(0, 1, 0), -filePos[1]);

      // Compute the ground-plane intersection at the click point
      const startHit = raycaster.ray.intersectPlane(
        dragPlane.current,
        _intersect,
      );
      if (!startHit) return;
      dragStartHit.current.copy(startHit);

      // Record initial positions of ALL selected files
      const initMap = new Map<string, [number, number, number]>();
      for (const id of selectedIds) {
        const override = posOverrides.get(id);
        const entry = layout.get(id);
        const p = override ?? entry?.position ?? [0, 0, 0];
        initMap.set(id, [p[0], p[1], p[2]]);
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

      draggedIds.forEach(id => {
        const index = fileIdToIndexRef.current.get(id);
        const body = index !== undefined ? rigidBodyRef.current?.[index] : undefined;
        if (body) {
          body.setBodyType(2, true); // 2 = KinematicPositionBased, wake
          const t = body.translation();
          dragStartYRef.current.set(id, t.y);
        }
      });

      potentialDrag.current = true;
      dragActive.current = false;
      startMouse.current = { x: e.clientX, y: e.clientY };
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

      // Compute new positions for all dragged files (maintain relative offsets)
      const newPositions = new Map<string, [number, number, number]>();
      for (const [id, initPos] of initialPositions.current) {
        newPositions.set(id, [
          initPos[0] + deltaX,
          initPos[1],
          initPos[2] + deltaZ,
        ]);
      }

      // Drive kinematic body positions so physics sees the card move
      if (draggedIdsRef.current) {
        draggedIdsRef.current.forEach(id => {
          const index = fileIdToIndexRef.current.get(id);
          const body = index !== undefined ? rigidBodyRef.current?.[index] : undefined;
          if (body) {
            const startY = dragStartYRef.current.get(id) ?? 1.0;
            const initPos = initialPositions.current.get(id);
            if (initPos) {
              body.setNextKinematicTranslation({
                x: initPos[0] + deltaX,
                y: startY + 1.0, // Float at Y+1.0 above drag plane per spec
                z: initPos[2] + deltaZ,
              });
            }
          }
        });
      }

      useDragStore.setState({ dragPositions: newPositions });

      // Compute drop target from the primary dragged file's XZ position
      if (draggedIdsRef.current && draggedIdsRef.current.length > 0) {
        const primaryId = draggedIdsRef.current[0];
        const primaryPos = newPositions.get(primaryId);
        if (primaryPos) {
          const targetId = findDropTarget(
            primaryPos[0],
            primaryPos[2],
            directoriesRef.current,
            layoutRef.current,
            rootPathRef.current,
          );
          useDragStore.setState({ dropTargetDirId: targetId });
        }
      }
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

        // Helper: restore a body to dynamic
        const restoreBody = (id: string) => {
          const index = fileIdToIndexRef.current.get(id);
          const body = index !== undefined ? rigidBodyRef.current?.[index] : undefined;
          if (body) {
            body.setBodyType(0, true); // Dynamic
            body.applyImpulse({ x: 0, y: 2, z: 0 }, true);
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
              body.setTranslation({ x: origPos[0], y: origPos[1] + 0.5, z: origPos[2] }, true);
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
          const { dragPositions } = useDragStore.getState();
          for (const id of sameDirIds) {
            const pos = dragPositions.get(id);
            if (pos) {
              store.setPositionOverride(id, pos);
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
              body.setBodyType(0, true);
              body.applyImpulse({ x: 0, y: 2, z: 0 }, true);
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
