import { useCallback, useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useCameraFocusStore } from '@/scene/CameraController';
import type { LayoutEntry } from '@/scene/layout/spatialLayout';

// ── Types ──────────────────────────────────────────────

interface SelectionBoxProps {
  layoutMap: Map<string, LayoutEntry>;
}

interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Point2D {
  x: number;
  y: number;
}

// Minimum drag distance (px) before we consider it a drag-select vs. a click
const DRAG_THRESHOLD = 5;

// ── Helpers ────────────────────────────────────────────

/**
 * Project a 3D world position to 2D screen coordinates
 * relative to the canvas element.
 */
const _projVec = new THREE.Vector3();

function projectToScreen(
  worldPos: [number, number, number],
  camera: THREE.Camera,
  canvasRect: DOMRect,
): Point2D {
  _projVec.set(worldPos[0], worldPos[1], worldPos[2]);
  _projVec.project(camera);

  return {
    x: ((_projVec.x + 1) / 2) * canvasRect.width,
    y: ((-_projVec.y + 1) / 2) * canvasRect.height,
  };
}

/**
 * Build an axis-aligned rectangle from two corner points.
 */
function rectFromPoints(a: Point2D, b: Point2D): ScreenRect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  return {
    left,
    top,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/**
 * Check if a point is inside a screen-space rectangle.
 */
function pointInRect(pt: Point2D, rect: ScreenRect): boolean {
  return (
    pt.x >= rect.left &&
    pt.x <= rect.left + rect.width &&
    pt.y >= rect.top &&
    pt.y <= rect.top + rect.height
  );
}

// ── Component ──────────────────────────────────────────

export default function SelectionBox({ layoutMap }: SelectionBoxProps) {
  const { camera, gl, scene, raycaster } = useThree();
  const selectMultiple = useSelectionStore((s) => s.selectMultiple);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const nodes = useFileTreeStore((s) => s.nodes);

  const isDragging = useRef(false);
  const passedThreshold = useRef(false);
  const startPoint = useRef<Point2D>({ x: 0, y: 0 });
  const [rect, setRect] = useState<ScreenRect | null>(null);

  const finishSelection = useCallback(
    (endPoint: Point2D) => {
      const start = startPoint.current;
      const selectionRect = rectFromPoints(start, endPoint);
      const canvasRect = gl.domElement.getBoundingClientRect();

      const selectedIds: string[] = [];

      // Iterate all file nodes and check if their projected screen position
      // falls within the selection rectangle.
      for (const node of nodes.values()) {
        if (node.type !== 'file') continue;

        const entry = layoutMap.get(node.id);
        if (!entry) continue;

        const screenPos = projectToScreen(entry.position, camera, canvasRect);

        // Skip points behind the camera (z > 1 in NDC = behind)
        _projVec.set(entry.position[0], entry.position[1], entry.position[2]);
        _projVec.project(camera);
        if (_projVec.z > 1) continue;

        if (pointInRect(screenPos, selectionRect)) {
          selectedIds.push(node.id);
        }
      }

      if (selectedIds.length > 0) {
        selectMultiple(selectedIds);
      } else {
        clearSelection();
      }
    },
    [camera, gl, nodes, layoutMap, selectMultiple, clearSelection],
  );

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      // Only left mouse button
      if (e.button !== 0) return;

      // Compute NDC coordinates for raycasting
      const canvasRect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
      const ndcY = -((e.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;

      // Raycast into the scene to check if we hit a file object (InstancedMesh)
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      const hitFileObject = intersects.some(
        (hit) => hit.object instanceof THREE.InstancedMesh,
      );

      if (hitFileObject) return;

      // Start drag-select
      isDragging.current = true;
      passedThreshold.current = false;
      const cr = canvas.getBoundingClientRect();
      startPoint.current = { x: e.clientX - cr.left, y: e.clientY - cr.top };
      setRect(null);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;

      const cr = canvas.getBoundingClientRect();
      const current: Point2D = { x: e.clientX - cr.left, y: e.clientY - cr.top };
      const dx = current.x - startPoint.current.x;
      const dy = current.y - startPoint.current.y;

      // Only start showing the rectangle after passing threshold
      if (!passedThreshold.current) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        passedThreshold.current = true;
        // Disable orbit controls once we start a real drag
        useCameraFocusStore.getState().setOrbitEnabled(false);
      }

      setRect(rectFromPoints(startPoint.current, current));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // Re-enable orbit controls
      useCameraFocusStore.getState().setOrbitEnabled(true);

      if (passedThreshold.current) {
        const cr = canvas.getBoundingClientRect();
        finishSelection({ x: e.clientX - cr.left, y: e.clientY - cr.top });
      }

      passedThreshold.current = false;
      setRect(null);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, camera, scene, raycaster, finishSelection]);

  // Don't render anything if no drag is active
  if (!rect) return null;

  return (
    <Html fullscreen>
      <div
        style={{
          position: 'absolute',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          border: '1.5px dashed rgba(122, 162, 247, 0.8)',
          backgroundColor: 'rgba(122, 162, 247, 0.12)',
          borderRadius: 2,
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      />
    </Html>
  );
}
