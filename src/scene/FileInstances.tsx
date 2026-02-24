import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  InstancedRigidBodies,
  CuboidCollider,
  type InstancedRigidBodyProps,
  type RapierRigidBody,
} from '@react-three/rapier';
import { RigidBodyType } from '@dimforge/rapier3d-compat';
import type { FileNode } from '@/types';
import {
  getFileColor,
  formatFileSize,
  formatModifiedDate,
} from '@/utils/fileClassification';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import type { LayoutEntry } from '@/scene/layout/spatialLayout';
import { useDragStore } from '@/scene/FileDragger';
import { theme } from '@/theme';

// ── Constants (non-LOD) ────────────────────────────────

// Staggered spawn constants
const SPAWN_Y_STEP = 0.5;
const MAX_SPAWN_Y_ABOVE = 10;

// LOD body-type check interval (frames)
const LOD_CHECK_INTERVAL = 30;

// Frame budget constants
const FRAME_BUDGET = 500; // max files to process per frame
const SORT_INTERVAL = 30; // re-sort every N frames

// LOD scale minimum (constant — does not scale with workspace)
const LOD_MIN_SCALE = 0.5;

// ── Shared card geometry (dog-eared page) ──────────────

function createCardGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.4, -0.55);  // bottom-left
  shape.lineTo(0.4, -0.55);   // bottom-right
  shape.lineTo(0.4, 0.35);    // right side up to fold start
  shape.lineTo(0.2, 0.55);    // fold diagonal
  shape.lineTo(-0.4, 0.55);   // top-left
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
  // Centre the geometry so the origin is in the middle
  geo.center();
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

const CARD_GEOMETRY = createCardGeometry();

// ── Types ──────────────────────────────────────────────

interface FileInstanceGroupProps {
  files: FileNode[];
  layoutMap: Map<string, LayoutEntry>;
  rigidBodyRef: React.MutableRefObject<(RapierRigidBody | null)[] | null>;
  fileIdToIndex: Map<string, number>;
}

interface FileInstancesProps {
  files: FileNode[];
  layoutMap: Map<string, LayoutEntry>;
  rigidBodyRef: React.MutableRefObject<(RapierRigidBody | null)[] | null>;
  fileIdToIndex: Map<string, number>;
}

/** Dynamic LOD thresholds computed from workspace extent */
interface LODThresholds {
  lodNear: number;
  lodFar: number;
  lodBillboard: number;
  lodBillboardInner: number;
}

// ── Hover label component ──────────────────────────────

function HoverLabel({ node, position }: { node: FileNode; position: [number, number, number] }) {
  const color = getFileColor(node.extension);
  return (
    <Html
      position={[position[0], position[1] + 2, position[2]]}
      distanceFactor={15}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: theme.colors.bgSurface,
          color: theme.colors.textPrimary,
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
          whiteSpace: 'nowrap',
          border: `1px solid ${color}`,
          boxShadow: `0 0 12px ${color}44`,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '2px' }}>{node.name}</div>
        <div style={{ opacity: 0.7, fontSize: '11px' }}>
          {formatFileSize(node.sizeBytes)} · {formatModifiedDate(node.modifiedAt)}
        </div>
      </div>
    </Html>
  );
}

// ── Instance group for a single shape type ─────────────

const _tempObject = new THREE.Object3D();
const _tempColor = new THREE.Color();

function FileInstanceGroup({ files, layoutMap, rigidBodyRef, fileIdToIndex }: FileInstanceGroupProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const select = useSelectionStore((s) => s.select);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const openContextMenu = useSelectionStore((s) => s.openContextMenu);
  const setHoveredId = useSelectionStore((s) => s.setHovered);
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  // ── Feature 1: Dynamic LOD thresholds from workspace extent ──
  const extent = useFileTreeStore((s) => s.workspaceBounds?.extent ?? 100);

  const lodNear = Math.max(extent * 0.1, 20);
  const lodFar = Math.max(extent * 0.3, 60);
  const lodBillboard = Math.max(extent * 1.2, 200);
  const lodBillboardInner = lodBillboard * 0.9; // hysteresis band

  // Frame counter for LOD body-type switching throttle
  const frameCountRef = useRef(0);

  // ── Feature 2: Frustum culling — pre-allocated objects ──
  const frustumRef = useRef(new THREE.Frustum());
  const projMatrixRef = useRef(new THREE.Matrix4());
  const tempVec = useRef(new THREE.Vector3());

  // ── Feature 3: Frame budget system ──
  const sortedIndicesRef = useRef<number[]>([]);
  const distanceCacheRef = useRef<Float32Array>(new Float32Array(0));
  const initialPassDoneRef = useRef(false);

  // ── Bug 1 fix: Track selection/search state to force full pass on change ──
  const lastSelectionSizeRef = useRef(0);
  const lastSearchQueryRef = useRef('');

  // Resize frame-budget arrays when file count changes
  useEffect(() => {
    const len = files.length;
    if (distanceCacheRef.current.length !== len) {
      distanceCacheRef.current = new Float32Array(len);
    }
    if (sortedIndicesRef.current.length !== len) {
      sortedIndicesRef.current = Array.from({ length: len }, (_, i) => i);
    }
    // Reset initial pass flag so all files get their matrix set
    initialPassDoneRef.current = false;
  }, [files.length]);

  // Track previously selected IDs to detect newly selected cards for impulse
  const prevSelectedIds = useRef<Set<string>>(new Set());

  // Target layout positions — updated when layoutMap changes, used for corrective force
  const targetPositionsRef = useRef<Map<string, [number, number, number]>>(new Map());
  useEffect(() => {
    const map = new Map<string, [number, number, number]>();
    for (const file of files) {
      const entry = layoutMap.get(file.id);
      if (entry) {
        map.set(file.id, entry.position);
      }
    }
    targetPositionsRef.current = map;
  }, [files, layoutMap]);

  // Staggered spawn: instances array drives initial physics body positions + per-instance scale
  const instances = useMemo<InstancedRigidBodyProps[]>(() =>
    files.map((file, index) => {
      const layout = layoutMap.get(file.id);
      const pos = layout?.position ?? ([0, 0.5, 0] as [number, number, number]);
      const rotY = layout?.rotationY ?? 0;
      const s = layout?.cardScale ?? 1;
      const spawnYOffset = Math.min(index * SPAWN_Y_STEP, MAX_SPAWN_Y_ABOVE);
      return {
        key: file.id,
        position: [pos[0], pos[1] + spawnYOffset, pos[2]] as [number, number, number],
        rotation: [0, rotY, 0] as [number, number, number],
        scale: [s, s, s] as [number, number, number],
      };
    }),
    [files, layoutMap],
  );

  // Pre-compute initial colors
  const { colorArray } = useMemo(() => {
    const colors = new Float32Array(files.length * 3);
    files.forEach((file, i) => {
      _tempColor.set(getFileColor(file.extension));
      colors[i * 3] = _tempColor.r;
      colors[i * 3 + 1] = _tempColor.g;
      colors[i * 3 + 2] = _tempColor.b;
    });
    return { colorArray: colors };
  }, [files]);

  // Sync file IDs to mesh userData for FileDragger raycast identification
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData.fileIds = files.map((f) => f.id);
    }
  }, [files]);

  // Selection impulse: apply upward impulse on newly selected cards
  // and lock/unlock translation & rotation axes accordingly
  useEffect(() => {
    if (!rigidBodyRef.current) return;

    // Restore full movement for newly deselected bodies
    prevSelectedIds.current.forEach((id) => {
      if (!selectedIds.has(id)) {
        const index = fileIdToIndex.get(id);
        if (index !== undefined && rigidBodyRef.current?.[index]) {
          const body = rigidBodyRef.current[index]!;
          body.setEnabledTranslations(true, true, true, true);
          body.setEnabledRotations(true, true, true, true);
        }
      }
    });

    // Apply impulse + constraints for newly selected bodies
    selectedIds.forEach((id) => {
      if (!prevSelectedIds.current.has(id)) {
        const index = fileIdToIndex.get(id);
        if (index !== undefined && rigidBodyRef.current?.[index]) {
          const body = rigidBodyRef.current[index]!;
          body.applyImpulse({ x: 0, y: 4, z: 0 }, true);
          body.setEnabledTranslations(false, true, false, true);
          body.setEnabledRotations(false, false, false, true);
        }
      }
    });

    prevSelectedIds.current = new Set(selectedIds);
  }, [selectedIds, fileIdToIndex, rigidBodyRef]);

  // Update colors + compose instance matrices from physics bodies every frame
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { selectedIds: selIds } = useSelectionStore.getState();

    // Search dimming: check if a search is active
    const fileTreeState = useFileTreeStore.getState();
    const searchActive = fileTreeState.searchQuery.trim().length > 0;
    const searchResultIds = searchActive ? new Set(fileTreeState.getSearchResults()) : null;

    frameCountRef.current++;

    // ── Feature 2: Update frustum from camera each frame ──
    projMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustumRef.current.setFromProjectionMatrix(projMatrixRef.current);

    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;

    // ── Feature 3: Re-sort files by distance every SORT_INTERVAL frames ──
    const fileCount = files.length;
    const shouldSort = frameCountRef.current % SORT_INTERVAL === 0;

    if (shouldSort && rigidBodyRef.current) {
      for (let i = 0; i < fileCount; i++) {
        const body = rigidBodyRef.current[i];
        if (!body) {
          distanceCacheRef.current[i] = Infinity;
          continue;
        }
        const t = body.translation();
        const dx = t.x - camX;
        const dz = t.z - camZ;
        distanceCacheRef.current[i] = dx * dx + dz * dz; // squared distance
      }
      sortedIndicesRef.current.sort(
        (a, b) => distanceCacheRef.current[a] - distanceCacheRef.current[b],
      );
    }

    // LOD body-type switching: throttled to every LOD_CHECK_INTERVAL frames
    if (frameCountRef.current % LOD_CHECK_INTERVAL === 0 && rigidBodyRef.current) {
      files.forEach((_, i) => {
        const body = rigidBodyRef.current?.[i];
        if (!body) return;
        // Skip kinematic bodies (being dragged or used as agent) to avoid freezing them mid-drag
        if (body.bodyType() === 2) return; // 2 = KinematicPositionBased
        const bodyPos = body.translation();
        const dist = Math.sqrt(
          (bodyPos.x - camX) ** 2 +
          (bodyPos.y - camY) ** 2 +
          (bodyPos.z - camZ) ** 2,
        );
        if (dist > lodBillboard) {
          body.setBodyType(RigidBodyType.Fixed, false);
        } else if (dist < lodBillboardInner) {
          body.setBodyType(RigidBodyType.Dynamic, true);
        }
      });
    }

    // Corrective force: gently nudge bodies toward their target layout positions
    // when layout recomputes (file add/remove/change), skipping during drags
    if (rigidBodyRef.current && !useDragStore.getState().isDragging) {
      const overrides = useFileTreeStore.getState().positionOverrides;
      const targets = targetPositionsRef.current;
      files.forEach((file, i) => {
        const body = rigidBodyRef.current?.[i];
        if (!body) return;
        // Skip kinematic bodies (being dragged)
        if (body.bodyType() === 2) return;
        // Skip bodies with user-defined position overrides
        if (overrides.has(file.id)) return;
        const target = targets.get(file.id);
        if (!target) return;
        const pos = body.translation();
        const dx = target[0] - pos.x;
        const dz = target[2] - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 1.0) {
          body.addForce({ x: (dx / dist) * 2.0, y: 0, z: (dz / dist) * 2.0 }, true);
        }
      });
    }

    // ── Feature 3: Determine which file indices to process this frame ──
    // On the initial pass (or when file count changes), process ALL files
    // to ensure every instance gets a valid matrix. After that, respect the budget.
    // Also force a full pass when selection or search state changes so color
    // updates propagate to ALL files immediately (Bug 1 fix).
    const currentSelectionSize = selIds.size;
    const currentSearchQuery = fileTreeState.searchQuery;
    let forceFullPass = false;
    if (currentSelectionSize !== lastSelectionSizeRef.current || currentSearchQuery !== lastSearchQueryRef.current) {
      forceFullPass = true;
      lastSelectionSizeRef.current = currentSelectionSize;
      lastSearchQueryRef.current = currentSearchQuery;
    }
    const processAll = !initialPassDoneRef.current || forceFullPass;
    const indicesToProcess = processAll
      ? sortedIndicesRef.current
      : sortedIndicesRef.current.slice(0, FRAME_BUDGET);

    for (const i of indicesToProcess) {
      if (i >= fileCount) continue;
      const file = files[i];
      const entry = layoutMap.get(file.id);
      const baseScale = entry?.cardScale ?? 1;
      const isHovered = hoveredIndex === i;
      const isSelected = selIds.has(file.id);
      const isSearchMatch = searchResultIds ? searchResultIds.has(file.id) : true;

      // Get physics body position/rotation for matrix composition
      const body = rigidBodyRef.current?.[i];
      if (body && mesh) {
        const t = body.translation();
        const r = body.rotation();

        // ── Feature 2: Frustum check — skip expensive work for off-screen instances ──
        tempVec.current.set(t.x, t.y, t.z);
        if (!frustumRef.current.containsPoint(tempVec.current)) {
          // Instance is off-screen: set scale to near-zero to save GPU fill
          // but still provide a valid matrix
          _tempObject.position.set(t.x, t.y, t.z);
          _tempObject.quaternion.set(r.x, r.y, r.z, r.w);
          _tempObject.scale.setScalar(0.001);
          _tempObject.updateMatrix();
          mesh.setMatrixAt(i, _tempObject.matrix);
          continue;
        }

        // LOD: scale down distant instances; hide beyond billboard threshold
        const dx = t.x - camX;
        const dy = t.y - camY;
        const dz = t.z - camZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        let targetScale: number;
        if (dist > lodBillboard) {
          // Beyond billboard distance: hide from instanced mesh (rendered as points instead)
          targetScale = 0;
        } else if (dist > lodBillboardInner) {
          // ── Feature 5: Smooth fade in billboard transition zone ──
          // Scale down from LOD_MIN_SCALE to 0 across the hysteresis band
          const lodFactor = dist <= lodNear
            ? 1
            : dist >= lodFar
              ? LOD_MIN_SCALE
              : 1 - (1 - LOD_MIN_SCALE) * ((dist - lodNear) / (lodFar - lodNear));
          const fadeOut = 1 - (dist - lodBillboardInner) / (lodBillboard - lodBillboardInner);
          targetScale = (isHovered ? baseScale * 1.15 : baseScale) * lodFactor * fadeOut;
        } else {
          const lodFactor = dist <= lodNear
            ? 1
            : dist >= lodFar
              ? LOD_MIN_SCALE
              : 1 - (1 - LOD_MIN_SCALE) * ((dist - lodNear) / (lodFar - lodNear));
          targetScale = (isHovered ? baseScale * 1.15 : baseScale) * lodFactor;
        }

        _tempObject.position.set(t.x, t.y, t.z);
        _tempObject.quaternion.set(r.x, r.y, r.z, r.w);
        _tempObject.scale.setScalar(targetScale);
        _tempObject.updateMatrix();
        mesh.setMatrixAt(i, _tempObject.matrix);
      }

      // Color: selected gets brighter, hovered gets a smaller boost
      // When search is active, dim non-matching files
      _tempColor.set(getFileColor(file.extension));
      if (searchActive && !isSearchMatch) {
        _tempColor.multiplyScalar(0.25);
      } else if (isSelected) {
        _tempColor.multiplyScalar(1.8);
      } else if (isHovered) {
        _tempColor.multiplyScalar(1.5);
      } else if (searchActive && isSearchMatch) {
        _tempColor.multiplyScalar(1.3);
      }
      mesh.setColorAt(i, _tempColor);
    }

    // Mark initial pass complete after first full iteration
    if (processAll) {
      initialPassDoneRef.current = true;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      // Suppress hover labels while dragging
      if (useDragStore.getState().isDragging) {
        setHoveredIndex(null);
        setHoveredId(null);
        return;
      }
      if (e.instanceId !== undefined && e.instanceId >= 0 && e.instanceId < files.length) {
        setHoveredIndex(e.instanceId);
        setHoveredId(files[e.instanceId].id);
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredIndex(null);
        setHoveredId(null);
        document.body.style.cursor = 'auto';
      }
    },
    [files, setHoveredId],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHoveredIndex(null);
      setHoveredId(null);
      document.body.style.cursor = 'auto';
    },
    [setHoveredId],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      // Ignore clicks that are actually the end of a drag
      if (useDragStore.getState().dragEndTime > Date.now() - 100) return;
      if (e.instanceId !== undefined && e.instanceId >= 0 && e.instanceId < files.length) {
        const id = files[e.instanceId].id;
        if (e.nativeEvent.shiftKey) {
          toggleSelect(id);
        } else {
          select(id);
        }
      }
    },
    [files, select, toggleSelect],
  );

  const handleDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (useDragStore.getState().dragEndTime > Date.now() - 100) return;
      if (e.instanceId !== undefined && e.instanceId >= 0 && e.instanceId < files.length) {
        window.electronAPI.openExternal(files[e.instanceId].path).catch((err: unknown) => {
          console.error('Failed to open externally:', err);
        });
      }
    },
    [files],
  );

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      if (e.instanceId !== undefined && e.instanceId >= 0 && e.instanceId < files.length) {
        openContextMenu(
          e.nativeEvent.clientX,
          e.nativeEvent.clientY,
          files[e.instanceId].id,
        );
      }
    },
    [files, openContextMenu],
  );

  // Get hovered file data for label — use physics body position if available
  const hoveredFile = hoveredIndex !== null ? files[hoveredIndex] : null;
  const hoveredPos = useMemo((): [number, number, number] | null => {
    if (!hoveredFile) return null;
    const body = rigidBodyRef.current?.[hoveredIndex!];
    if (body) {
      const t = body.translation();
      return [t.x, t.y, t.z];
    }
    return layoutMap.get(hoveredFile.id)?.position ?? null;
  }, [hoveredFile, hoveredIndex, rigidBodyRef, layoutMap]);

  // Memoize a stable material so it's not re-created on every render
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }),
    [],
  );

  // Dispose instanced mesh GPU resources when the file count changes or on unmount
  useEffect(() => {
    const mesh = meshRef.current;
    return () => {
      if (mesh) {
        mesh.dispose();
      }
    };
  }, [files.length]);

  // Dispose material on unmount
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <>
      <InstancedRigidBodies
        ref={rigidBodyRef}
        instances={instances}
        colliders={false}
        colliderNodes={[<CuboidCollider args={[0.4, 0.55, 0.015]} />]}
        restitution={0.15}
        friction={0.8}
      >
        <instancedMesh
          ref={meshRef}
          key={files.length}
          args={[CARD_GEOMETRY, material, files.length]}
          count={files.length}
          frustumCulled={false}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        >
          <instancedBufferAttribute
            attach="instanceColor"
            args={[colorArray, 3]}
          />
        </instancedMesh>
      </InstancedRigidBodies>
      {hoveredFile && hoveredPos && (
        <HoverLabel
          node={hoveredFile}
          position={hoveredPos}
        />
      )}
    </>
  );
}

// ── Always-visible filename labels for nearby files ────

const LABEL_UPDATE_INTERVAL = 10; // frames between recalculations

interface LabelEntry {
  id: string;
  name: string;
  position: [number, number, number];
}

function truncateName(name: string, max = 20): string {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

function NearbyLabels({ files, layoutMap, rigidBodyRef, fileIdToIndex }: FileInstancesProps) {
  const { camera } = useThree();
  const [visibleLabels, setVisibleLabels] = useState<LabelEntry[]>([]);
  const frameCount = useRef(0);
  const prevLabelIdsRef = useRef('');

  // Get position from physics body if available, fallback to layoutMap
  const getCardPos = useCallback(
    (file: FileNode, index: number): [number, number, number] => {
      const body = rigidBodyRef.current?.[index];
      if (body) {
        const t = body.translation();
        return [t.x, t.y + 0.7, t.z];
      }
      const layout = layoutMap.get(file.id);
      return layout?.position
        ? [layout.position[0], layout.position[1] + 0.7, layout.position[2]]
        : [0, 0.7, 0];
    },
    [rigidBodyRef, layoutMap],
  );

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % LABEL_UPDATE_INTERVAL !== 0) return;

    // ── Feature 4: Label distance scales with camera height ──
    const cameraHeight = camera.position.y;
    const labelDist = Math.max(cameraHeight * 0.8, 35);

    // Max labels scales with file count (minimum 50, maximum 100)
    const maxLabels = Math.min(Math.max(Math.ceil(files.length * 0.1), 50), 100);

    const candidates: { id: string; name: string; position: [number, number, number]; dist: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pos = getCardPos(file, i);

      // Label position is offset +0.7 above card; measure distance from base
      const basePos: [number, number, number] = [pos[0], pos[1] - 0.7, pos[2]];
      const dx = basePos[0] - camera.position.x;
      const dy = basePos[1] - camera.position.y;
      const dz = basePos[2] - camera.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= labelDist) {
        candidates.push({ id: file.id, name: file.name, position: pos, dist });
      }
    }

    // Sort by distance, take closest maxLabels
    candidates.sort((a, b) => a.dist - b.dist);
    const closest = candidates.slice(0, maxLabels);

    // Only trigger a React re-render if the visible label set actually changed
    const newIds = closest.map((c) => c.id).join(',');
    if (newIds !== prevLabelIdsRef.current) {
      prevLabelIdsRef.current = newIds;
      setVisibleLabels(
        closest.map((c) => ({ id: c.id, name: c.name, position: c.position })),
      );
    }
  });

  // Suppress unused-var warning — fileIdToIndex is part of the shared props interface
  void fileIdToIndex;

  return (
    <>
      {visibleLabels.map((label) => (
        <Html
          key={label.id}
          position={[label.position[0], label.position[1] - 0.3, label.position[2]]}
          distanceFactor={12}
          style={{ pointerEvents: 'none' }}
          center
        >
          <div style={{
            color: theme.colors.textSecondary,
            fontSize: '10px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            textShadow: `0 0 4px ${theme.colors.bgBase}`,
            userSelect: 'none',
          }}>
            {truncateName(label.name)}
          </div>
        </Html>
      ))}
    </>
  );
}

// ── Billboard points for very distant files ───────────

interface BillboardPointsProps extends FileInstancesProps {
  lodThresholds: LODThresholds;
}

function BillboardPoints({ files, layoutMap, rigidBodyRef, lodThresholds }: BillboardPointsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();

  // ── Feature 1 & 5: Dynamic LOD thresholds + workspace-scaled point size ──
  const extent = useFileTreeStore((s) => s.workspaceBounds?.extent ?? 100);
  const { lodBillboard, lodBillboardInner } = lodThresholds;

  // ── Feature 5: Point size scales with workspace extent, minimum 4 ──
  const pointSize = Math.max(extent * 0.02, 4);

  // Pre-allocate geometry + typed arrays sized to file count
  const { positions, colors, geometry, material } = useMemo(() => {
    const pos = new Float32Array(files.length * 3);
    const col = new Float32Array(files.length * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geom.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      size: pointSize,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    return { positions: pos, colors: col, geometry: geom, material: mat };
  }, [files.length, pointSize]);

  // Dispose old geometry/material when they are replaced
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    if (!pointsRef.current) return;

    // Update material size dynamically in case extent changes between memo recalculations
    material.size = pointSize;

    const fileTreeState = useFileTreeStore.getState();
    const searchActive = fileTreeState.searchQuery.trim().length > 0;
    const searchResultIds = searchActive ? new Set(fileTreeState.getSearchResults()) : null;

    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Use physics body position if available, fallback to layout
      let pos: [number, number, number];
      const body = rigidBodyRef.current?.[i];
      if (body) {
        const t = body.translation();
        pos = [t.x, t.y, t.z];
      } else {
        const layout = layoutMap.get(file.id);
        pos = layout?.position ?? [0, 0, 0];
      }

      const dx = pos[0] - camera.position.x;
      const dy = pos[1] - camera.position.y;
      const dz = pos[2] - camera.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // ── Feature 5: Show billboard points starting from lodBillboardInner ──
      // This creates overlap with the instance mesh in the transition zone
      // for a smooth crossfade effect (instances scale down while points appear)
      if (dist > lodBillboardInner) {
        positions[count * 3] = pos[0];
        positions[count * 3 + 1] = pos[1];
        positions[count * 3 + 2] = pos[2];

        _tempColor.set(getFileColor(file.extension));

        // Fade in point opacity within the transition zone
        let pointAlpha = 1.0;
        if (dist < lodBillboard) {
          // Transition zone: fade from 0 to 1 as dist goes from lodBillboardInner to lodBillboard
          pointAlpha = (dist - lodBillboardInner) / (lodBillboard - lodBillboardInner);
        }

        // Dim non-matching files during search
        if (searchActive && searchResultIds && !searchResultIds.has(file.id)) {
          _tempColor.multiplyScalar(0.25);
        }

        // Apply fade-in alpha by dimming color (vertex-color based fade)
        _tempColor.multiplyScalar(pointAlpha);

        colors[count * 3] = _tempColor.r;
        colors[count * 3 + 1] = _tempColor.g;
        colors[count * 3 + 2] = _tempColor.b;

        count++;
      }
    }

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geometry.setDrawRange(0, count);
  });

  return <points ref={pointsRef} args={[geometry, material]} frustumCulled={false} />;
}

// ── Main component: single InstancedMesh for all files ─────────────────────

export default function FileInstances({ files, layoutMap, rigidBodyRef, fileIdToIndex }: FileInstancesProps) {
  // ── Feature 1: Compute LOD thresholds for child components ──
  const extent = useFileTreeStore((s) => s.workspaceBounds?.extent ?? 100);

  const lodThresholds: LODThresholds = useMemo(() => ({
    lodNear: Math.max(extent * 0.1, 20),
    lodFar: Math.max(extent * 0.3, 60),
    lodBillboard: Math.max(extent * 1.2, 200),
    lodBillboardInner: Math.max(extent * 1.2, 200) * 0.9,
  }), [extent]);

  return (
    <>
      {files.length > 0 && (
        <FileInstanceGroup
          files={files}
          layoutMap={layoutMap}
          rigidBodyRef={rigidBodyRef}
          fileIdToIndex={fileIdToIndex}
        />
      )}
      <BillboardPoints
        files={files}
        layoutMap={layoutMap}
        rigidBodyRef={rigidBodyRef}
        fileIdToIndex={fileIdToIndex}
        lodThresholds={lodThresholds}
      />
      <NearbyLabels files={files} layoutMap={layoutMap} rigidBodyRef={rigidBodyRef} fileIdToIndex={fileIdToIndex} />
    </>
  );
}
