import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useCameraFocusStore } from '@/scene/CameraController';
import type { LayoutEntry } from '@/scene/layout/spatialLayout';

// ── Resize state store ──────────────────────────────────
// Read via getState() in event handlers for zero re-render overhead.

type Corner = 'nw' | 'ne' | 'sw' | 'se';

interface ResizeState {
  /** Whether a resize drag is currently in progress. */
  isResizing: boolean;
  /** The directory being resized. */
  dirId: string | null;
  /** Which corner is being dragged. */
  corner: Corner | null;
  /** XZ world position of the opposite (fixed) corner. */
  anchorWorld: [number, number] | null;
  /** Platform size at drag start [width, depth]. */
  startSize: [number, number] | null;
  /** XZ center of the platform at drag start. */
  startCenter: [number, number] | null;
}

export const useResizeStore = create<ResizeState>(() => ({
  isResizing: false,
  dirId: null,
  corner: null,
  anchorWorld: null,
  startSize: null,
  startCenter: null,
}));

// ── Constants ───────────────────────────────────────────

/** Minimum platform dimension on either axis. */
const MIN_SIZE = 3;

/** Minimum pixel distance before a click becomes a resize drag. */
const DRAG_THRESHOLD = 5;

// ── Reusable temp objects (avoid GC pressure) ───────────

const _ndc = new THREE.Vector2();
const _intersect = new THREE.Vector3();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ── Helpers ─────────────────────────────────────────────

/**
 * Compute the world-space XZ position of the corner opposite to `corner`.
 * The anchor stays fixed while the dragged corner moves.
 */
function computeAnchor(
  corner: Corner,
  centerX: number,
  centerZ: number,
  halfW: number,
  halfD: number,
): [number, number] {
  switch (corner) {
    case 'se': return [centerX - halfW, centerZ - halfD]; // anchor = nw
    case 'sw': return [centerX + halfW, centerZ - halfD]; // anchor = ne
    case 'ne': return [centerX - halfW, centerZ + halfD]; // anchor = sw
    case 'nw': return [centerX + halfW, centerZ + halfD]; // anchor = se
  }
}

// ── Component ───────────────────────────────────────────

interface DirectoryResizerProps {
  layoutMap: Map<string, LayoutEntry>;
}

/**
 * Invisible controller that lets users resize directory platforms by
 * dragging their corner handles. Follows the same event-driven pattern
 * as FileDragger — attaches to the canvas's pointer events and uses
 * Three.js raycasting for all 3D interaction.
 */
export default function DirectoryResizer(_props: DirectoryResizerProps) {
  const { gl, camera, scene, raycaster } = useThree();

  // Drag tracking refs — mutated during pointer events, no React renders
  const potentialResize = useRef(false);
  const resizeActive = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });

  /** Y coordinate of the directory platform (preserved during resize). */
  const dirYRef = useRef(0);

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

    /** Raycast pointer against the Y=0 ground plane. */
    const hitGroundPlane = (e: PointerEvent): THREE.Vector3 | null => {
      raycaster.setFromCamera(getNDC(e), camera);
      return raycaster.ray.intersectPlane(_groundPlane, _intersect);
    };

    // ── Pointer handlers ─────────────────────────────────

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // Raycast into scene to find a corner-handle mesh
      raycaster.setFromCamera(getNDC(e), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const hit = intersects.find(
        (i) => i.object.userData?.type === 'corner-handle',
      );
      if (!hit) return;

      const { dirId, corner, dirPosition, platformSize } = hit.object.userData as {
        dirId: string;
        corner: Corner;
        dirPosition: [number, number, number];
        platformSize: [number, number];
      };

      // Compute the anchor (opposite corner) in world XZ space
      const [cx, cy, cz] = dirPosition;
      const [w, d] = platformSize;
      const anchorWorld = computeAnchor(corner, cx, cz, w / 2, d / 2);

      dirYRef.current = cy;

      // Prime the resize — but don't activate until the pixel threshold is met
      useResizeStore.setState({
        isResizing: false,
        dirId,
        corner,
        anchorWorld,
        startSize: [w, d],
        startCenter: [cx, cz],
      });

      potentialResize.current = true;
      resizeActive.current = false;
      startMouse.current = { x: e.clientX, y: e.clientY };

      // Prevent this event from propagating to FileDragger / SelectionBox
      e.stopPropagation();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!potentialResize.current) return;

      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;

      // Activate resize once the pixel threshold is exceeded
      if (!resizeActive.current) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        resizeActive.current = true;
        useResizeStore.setState({ isResizing: true });
        useCameraFocusStore.getState().setOrbitEnabled(false);
      }

      // Read the current resize state
      const state = useResizeStore.getState();
      if (!state.dirId || !state.anchorWorld) return;

      // Raycast current pointer against the ground plane
      const current = hitGroundPlane(e);
      if (!current) return;

      const [anchorX, anchorZ] = state.anchorWorld;
      const cursorX = current.x;
      const cursorZ = current.z;

      // Compute new dimensions with minimum size enforcement
      const rawWidth = Math.abs(cursorX - anchorX);
      const rawDepth = Math.abs(cursorZ - anchorZ);
      const newWidth = Math.max(rawWidth, MIN_SIZE);
      const newDepth = Math.max(rawDepth, MIN_SIZE);

      // Compute new center — use the midpoint between anchor and cursor,
      // but adjust for min-size clamping to keep the anchor corner fixed.
      const signX = cursorX >= anchorX ? 1 : -1;
      const signZ = cursorZ >= anchorZ ? 1 : -1;
      const effectiveX = anchorX + signX * newWidth;
      const effectiveZ = anchorZ + signZ * newDepth;
      const newCenterX = (anchorX + effectiveX) / 2;
      const newCenterZ = (anchorZ + effectiveZ) / 2;

      // Commit to the store
      const store = useFileTreeStore.getState();
      store.setSizeOverride(state.dirId, [newWidth, newDepth]);
      store.setPositionOverride(state.dirId, [newCenterX, dirYRef.current, newCenterZ]);
    };

    const onPointerUp = () => {
      if (!potentialResize.current) return;
      potentialResize.current = false;

      if (resizeActive.current) {
        resizeActive.current = false;
        // Re-enable camera orbit
        useCameraFocusStore.getState().setOrbitEnabled(true);
      }

      // Reset cursor in case pointer-up happens away from the handle
      document.body.style.cursor = 'auto';

      // Reset the resize store
      useResizeStore.setState({
        isResizing: false,
        dirId: null,
        corner: null,
        anchorWorld: null,
        startSize: null,
        startCenter: null,
      });
    };

    // Register on canvas for pointerdown (to match FileDragger),
    // window for move/up so dragging outside the canvas still works.
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
