import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { FileNode } from '@/types';
import {
  getFileColor,
  getFileScale,
  formatFileSize,
  formatModifiedDate,
} from '@/utils/fileClassification';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import type { LayoutEntry } from '@/scene/layout/spatialLayout';
import { useDragStore } from '@/scene/FileDragger';
import { theme } from '@/theme';

// LOD: instances farther than this from the camera start scaling down
const LOD_NEAR = 60;
const LOD_FAR = 200;
const LOD_MIN_SCALE = 0.5;
// Beyond this distance, files are rendered as simple colored points instead of 3D geometry
const LOD_BILLBOARD = 500;

// Selection lift height (world units)
const SELECTION_LIFT = 0.5;

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
}

interface FileInstancesProps {
  files: FileNode[];
  layoutMap: Map<string, LayoutEntry>;
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

function FileInstanceGroup({ files, layoutMap }: FileInstanceGroupProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const select = useSelectionStore((s) => s.select);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const openContextMenu = useSelectionStore((s) => s.openContextMenu);
  const setHoveredId = useSelectionStore((s) => s.setHovered);

  // Track per-instance lift for smooth animation
  const liftRef = useRef<Float32Array | null>(null);

  // Pre-compute matrices and colors
  const { colorArray } = useMemo(() => {
    const colors = new Float32Array(files.length * 3);

    files.forEach((file, i) => {
      const layout = layoutMap.get(file.id);
      const pos = layout?.position ?? [0, 0, 0];
      const rotY = layout?.rotationY ?? 0;
      const scale = getFileScale(file.sizeBytes);

      _tempObject.position.set(pos[0], pos[1], pos[2]);
      _tempObject.scale.set(scale, scale, scale);
      _tempObject.rotation.set(0, rotY, 0);
      _tempObject.updateMatrix();

      _tempColor.set(getFileColor(file.extension));
      colors[i * 3] = _tempColor.r;
      colors[i * 3 + 1] = _tempColor.g;
      colors[i * 3 + 2] = _tempColor.b;
    });

    return { colorArray: colors };
  }, [files, layoutMap]);

  // Sync file IDs to mesh userData for FileDragger raycast identification
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData.fileIds = files.map((f) => f.id);
    }
  }, [files]);

  // Update instance matrices every frame (for hover + selection animations)
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { selectedIds } = useSelectionStore.getState();
    const { isDragging: dragging, dragPositions } = useDragStore.getState();

    // Search dimming: check if a search is active
    const fileTreeState = useFileTreeStore.getState();
    const searchActive = fileTreeState.searchQuery.trim().length > 0;
    const searchResultIds = searchActive ? new Set(fileTreeState.getSearchResults()) : null;
    const posOverrides = fileTreeState.positionOverrides;

    // Ensure lift array matches file count
    if (!liftRef.current || liftRef.current.length !== files.length) {
      liftRef.current = new Float32Array(files.length);
    }
    const lifts = liftRef.current;

    files.forEach((file, i) => {
      const layout = layoutMap.get(file.id);
      const autoPos = layout?.position ?? [0, 0, 0];
      // Priority: drag-in-progress > committed override > auto-layout
      const dragPos = dragging ? dragPositions.get(file.id) : undefined;
      const overridePos = posOverrides.get(file.id);
      const pos = dragPos ?? overridePos ?? autoPos;
      const baseScale = getFileScale(file.sizeBytes);
      const isHovered = hoveredIndex === i;
      const isSelected = selectedIds.has(file.id);
      const isSearchMatch = searchResultIds ? searchResultIds.has(file.id) : true;

      // LOD: scale down distant instances; hide beyond billboard threshold
      const dx = pos[0] - camera.position.x;
      const dy = pos[1] - camera.position.y;
      const dz = pos[2] - camera.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      let targetScale: number;
      if (dist > LOD_BILLBOARD) {
        // Beyond billboard distance: hide from instanced mesh (rendered as points instead)
        targetScale = 0;
      } else {
        const lodFactor = dist <= LOD_NEAR
          ? 1
          : dist >= LOD_FAR
            ? LOD_MIN_SCALE
            : 1 - (1 - LOD_MIN_SCALE) * ((dist - LOD_NEAR) / (LOD_FAR - LOD_NEAR));
        targetScale = (isHovered ? baseScale * 1.15 : baseScale) * lodFactor;
      }

      // Smooth lift animation for selected instances
      const targetLift = isSelected ? SELECTION_LIFT : 0;
      lifts[i] += (targetLift - lifts[i]) * 0.12;

      const rotY = layout?.rotationY ?? 0;
      _tempObject.position.set(pos[0], pos[1] + lifts[i], pos[2]);
      _tempObject.scale.set(targetScale, targetScale, targetScale);
      _tempObject.rotation.set(0, rotY, 0);
      _tempObject.updateMatrix();

      mesh.setMatrixAt(i, _tempObject.matrix);

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
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
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
      if (e.instanceId !== undefined) {
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
      if (e.instanceId !== undefined) {
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
      if (e.instanceId !== undefined) {
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
      if (e.instanceId !== undefined) {
        openContextMenu(
          e.nativeEvent.clientX,
          e.nativeEvent.clientY,
          files[e.instanceId].id,
        );
      }
    },
    [files, openContextMenu],
  );

  // Get hovered file data for label
  const hoveredFile = hoveredIndex !== null ? files[hoveredIndex] : null;
  const hoveredPos = hoveredFile
    ? layoutMap.get(hoveredFile.id)?.position ?? null
    : null;

  // Memoize a stable material so it's not re-created on every render
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }),
    [],
  );

  const geometry = CARD_GEOMETRY;

  // Dispose instanced mesh GPU resources (instanceMatrix, instanceColor) when
  // the file count changes (args forces a new InstancedMesh) or on unmount.
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
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, files.length]}
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

const LABEL_DISTANCE = 35;
const MAX_LABELS = 50;
const LABEL_UPDATE_INTERVAL = 10; // frames between recalculations

interface LabelEntry {
  id: string;
  name: string;
  position: [number, number, number];
}

function truncateName(name: string, max = 20): string {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

function NearbyLabels({ files, layoutMap }: FileInstancesProps) {
  const { camera } = useThree();
  const [visibleLabels, setVisibleLabels] = useState<LabelEntry[]>([]);
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % LABEL_UPDATE_INTERVAL !== 0) return;

    const posOverrides = useFileTreeStore.getState().positionOverrides;
    const { isDragging: dragging, dragPositions } = useDragStore.getState();

    const candidates: { id: string; name: string; position: [number, number, number]; dist: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const layout = layoutMap.get(file.id);
      const autoPos = layout?.position ?? [0, 0, 0];
      const dragPos = dragging ? dragPositions.get(file.id) : undefined;
      const overridePos = posOverrides.get(file.id);
      const pos = dragPos ?? overridePos ?? autoPos;

      const dx = pos[0] - camera.position.x;
      const dy = pos[1] - camera.position.y;
      const dz = pos[2] - camera.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= LABEL_DISTANCE) {
        candidates.push({ id: file.id, name: file.name, position: pos as [number, number, number], dist });
      }
    }

    // Sort by distance, take closest MAX_LABELS
    candidates.sort((a, b) => a.dist - b.dist);
    const closest = candidates.slice(0, MAX_LABELS);

    setVisibleLabels(
      closest.map((c) => ({ id: c.id, name: c.name, position: c.position })),
    );
  });

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

function BillboardPoints({ files, layoutMap }: FileInstancesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();

  // Pre-allocate geometry + typed arrays sized to file count
  const { positions, colors, geometry, material } = useMemo(() => {
    const pos = new Float32Array(files.length * 3);
    const col = new Float32Array(files.length * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geom.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      size: 3,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    return { positions: pos, colors: col, geometry: geom, material: mat };
  }, [files.length]);

  // Dispose old geometry/material when they are replaced
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    if (!pointsRef.current) return;

    const posOverrides = useFileTreeStore.getState().positionOverrides;
    const { isDragging: dragging, dragPositions } = useDragStore.getState();
    const fileTreeState = useFileTreeStore.getState();
    const searchActive = fileTreeState.searchQuery.trim().length > 0;
    const searchResultIds = searchActive ? new Set(fileTreeState.getSearchResults()) : null;

    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const layout = layoutMap.get(file.id);
      const autoPos = layout?.position ?? [0, 0, 0];
      const dragPos = dragging ? dragPositions.get(file.id) : undefined;
      const overridePos = posOverrides.get(file.id);
      const pos = dragPos ?? overridePos ?? autoPos;

      const dx = pos[0] - camera.position.x;
      const dy = pos[1] - camera.position.y;
      const dz = pos[2] - camera.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > LOD_BILLBOARD) {
        positions[count * 3] = pos[0];
        positions[count * 3 + 1] = pos[1];
        positions[count * 3 + 2] = pos[2];

        _tempColor.set(getFileColor(file.extension));
        // Dim non-matching files during search
        if (searchActive && searchResultIds && !searchResultIds.has(file.id)) {
          _tempColor.multiplyScalar(0.25);
        }
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

export default function FileInstances({ files, layoutMap }: FileInstancesProps) {
  return (
    <>
      {files.length > 0 && (
        <FileInstanceGroup
          files={files}
          layoutMap={layoutMap}
        />
      )}
      <BillboardPoints files={files} layoutMap={layoutMap} />
      <NearbyLabels files={files} layoutMap={layoutMap} />
    </>
  );
}
