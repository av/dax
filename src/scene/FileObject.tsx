import { useRef, useState, useCallback } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import type { FileNode } from '@/types';
import {
  getFileShape,
  getFileColor,
  getFileScale,
  formatFileSize,
  formatModifiedDate,
} from '@/utils/fileClassification';
import { useSelectionStore } from '@/stores/selectionStore';
import { theme } from '@/theme';

interface FileObjectProps {
  node: FileNode;
  position: [number, number, number];
}

// Pre-created geometries (shared)
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const sphereGeometry = new THREE.SphereGeometry(0.5, 24, 24);
const cylinderGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1, 24);
const torusGeometry = new THREE.TorusGeometry(0.4, 0.15, 16, 32);

function getGeometry(shape: string): THREE.BufferGeometry {
  switch (shape) {
    case 'sphere': return sphereGeometry;
    case 'cylinder': return cylinderGeometry;
    case 'torus': return torusGeometry;
    default: return boxGeometry;
  }
}

/**
 * Individual file mesh component.
 * Used for nearby objects (LOD detail level) or as a fallback.
 * For batch rendering, FileInstances.tsx handles the instanced path.
 */
export default function FileObject({ node, position }: FileObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const select = useSelectionStore((s) => s.select);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const openContextMenu = useSelectionStore((s) => s.openContextMenu);
  const setHoveredId = useSelectionStore((s) => s.setHovered);

  const shape = getFileShape(node.extension);
  const color = getFileColor(node.extension);
  const scale = getFileScale(node.sizeBytes);

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
      setHoveredId(node.id);
      document.body.style.cursor = 'pointer';
    },
    [node.id, setHoveredId],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(false);
      setHoveredId(null);
      document.body.style.cursor = 'auto';
    },
    [setHoveredId],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.nativeEvent.shiftKey) {
        toggleSelect(node.id);
      } else {
        select(node.id);
      }
    },
    [node.id, select, toggleSelect],
  );

  const handleDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      window.electronAPI.openExternal(node.path).catch((err: unknown) => {
        console.error('Failed to open externally:', err);
      });
    },
    [node.path],
  );

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      openContextMenu(
        e.nativeEvent.clientX,
        e.nativeEvent.clientY,
        node.id,
      );
    },
    [node.id, openContextMenu],
  );

  // Animate hover glow + selection lift
  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const isSelected = useSelectionStore.getState().selectedIds.has(node.id);

    const targetEmissive = isSelected ? 0.6 : hovered ? 0.4 : 0;
    mat.emissiveIntensity +=
      (targetEmissive - mat.emissiveIntensity) * 0.1;

    const targetScale = hovered ? scale * 1.15 : scale;
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1,
    );
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={[scale, scale, scale]}
      geometry={getGeometry(shape)}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      frustumCulled
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0}
        roughness={0.4}
        metalness={0.1}
      />
      {hovered && (
        <Html
          distanceFactor={15}
          position={[0, 1.2, 0]}
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
      )}
    </mesh>
  );
}
