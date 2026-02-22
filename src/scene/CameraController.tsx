import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';

// ── Camera focus store ─────────────────────────────────

interface CameraFocusState {
  target: THREE.Vector3 | null;
  orbitEnabled: boolean;
  setFocusTarget: (position: [number, number, number]) => void;
  clearFocusTarget: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
}

export const useCameraFocusStore = create<CameraFocusState>((set) => ({
  target: null,
  orbitEnabled: true,
  setFocusTarget: (position: [number, number, number]) =>
    set({ target: new THREE.Vector3(position[0], position[1], position[2]) }),
  clearFocusTarget: () => set({ target: null }),
  setOrbitEnabled: (enabled: boolean) => set({ orbitEnabled: enabled }),
}));

// ── RTS Camera constants ───────────────────────────────

/** Fixed pitch angle in radians (~55° from horizontal → camera looks down) */
const CAMERA_PITCH = 55 * (Math.PI / 180);

/** Height limits for zoom */
const MIN_HEIGHT = 5;
const MAX_HEIGHT = 150;

/** Zoom speed (height change per scroll tick) */
const ZOOM_SPEED = 2;

/** Pan speed multiplier for mouse drag (scaled by height for consistent feel) */
const DRAG_PAN_SPEED = 0.003;

/** Keyboard pan speed (units per second) */
const KEY_PAN_SPEED = 30;

/** Damping factor — lower = more inertia, 1 = instant */
const DAMPING = 0.1;

/** Intro animation */
const INTRO_HEIGHT = 25;
const INTRO_LOOK_AT = new THREE.Vector3(0, 0, 0);
const INTRO_LERP_SPEED = 0.035;

// ── Shared look-at state for external consumers ────────

const _currentLookAt = new THREE.Vector3(0, 0, 0);

/**
 * Returns the world position the camera is currently looking at (ground plane
 * intersection). Useful for the minimap viewport indicator.
 */
export function getCameraLookAt(): [number, number, number] {
  return [_currentLookAt.x, _currentLookAt.y, _currentLookAt.z];
}

// ── Helper: compute camera position from a lookAt + height ─

function cameraPositionFromLookAt(
  lookAt: THREE.Vector3,
  height: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  // Camera is offset along +Z and +Y from the look-at point based on pitch
  const zOffset = height / Math.tan(CAMERA_PITCH);
  out.set(lookAt.x, lookAt.y + height, lookAt.z + zOffset);
  return out;
}

// ── CameraController component ─────────────────────────

export default function CameraController() {
  const { camera, gl } = useThree();
  const controlsEnabled = useCameraFocusStore((s) => s.orbitEnabled);
  const focusTarget = useCameraFocusStore((s) => s.target);
  const clearFocusTarget = useCameraFocusStore((s) => s.clearFocusTarget);

  // --- Mutable refs for per-frame state (no re-renders) ---

  /** The position the camera is looking at (smoothed) */
  const lookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  /** The desired look-at position (before damping) */
  const lookAtGoalRef = useRef(new THREE.Vector3(0, 0, 0));
  /** Current camera height */
  const heightRef = useRef(INTRO_HEIGHT);
  /** Target camera height (before damping) */
  const heightGoalRef = useRef(INTRO_HEIGHT);

  /** Accumulated velocity from mouse drag (damped over time) */
  const dragVelocityRef = useRef(new THREE.Vector2(0, 0));
  /** Whether a drag-pan is active */
  const isDraggingRef = useRef(false);
  /** Previous mouse position during drag */
  const prevMouseRef = useRef(new THREE.Vector2(0, 0));

  /** Keys currently held down */
  const keysRef = useRef(new Set<string>());

  /** Mirrors store orbitEnabled so closure-captured handlers stay in sync */
  const controlsEnabledRef = useRef(controlsEnabled);
  useEffect(() => {
    controlsEnabledRef.current = controlsEnabled;
  }, [controlsEnabled]);

  const [introComplete, setIntroComplete] = useState(false);

  // Scratch vectors to avoid per-frame allocations
  const _desiredPos = useRef(new THREE.Vector3());

  // --- Input event handlers ---

  useEffect(() => {
    const domElement = gl.domElement;

    // -- Mouse / Pointer --

    const onPointerDown = (e: PointerEvent) => {
      if (!controlsEnabledRef.current) return;
      // Middle-click (button 1) or Right-click (button 2) → start pan
      if (e.button === 1 || e.button === 2) {
        isDraggingRef.current = true;
        prevMouseRef.current.set(e.clientX, e.clientY);
        domElement.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current.set(e.clientX, e.clientY);

      // Scale pan by height so it feels consistent at every zoom level
      const scale = heightRef.current * DRAG_PAN_SPEED;
      // Move along world X and Z.  screen-right → +X, screen-up → -Z
      lookAtGoalRef.current.x -= dx * scale;
      lookAtGoalRef.current.z -= dy * scale;

      // Store velocity for inertia
      dragVelocityRef.current.set(-dx * scale, -dy * scale);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 1 || e.button === 2) {
        isDraggingRef.current = false;
        domElement.releasePointerCapture(e.pointerId);
      }
    };

    // -- Scroll (zoom) --

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!controlsEnabledRef.current) return;
      const delta = e.deltaY > 0 ? ZOOM_SPEED : -ZOOM_SPEED;
      // Scale zoom step with current height for smooth feel at all levels
      const scaledDelta = delta * (heightRef.current / 20);
      heightGoalRef.current = THREE.MathUtils.clamp(
        heightGoalRef.current + scaledDelta,
        MIN_HEIGHT,
        MAX_HEIGHT,
      );
    };

    // -- Keyboard --

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    // Disable default context-menu so right-drag works
    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    domElement.addEventListener('contextmenu', onContextMenu);

    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      domElement.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl]);

  // --- Per-frame update ---

  useFrame((_state, delta) => {
    const lookAt = lookAtRef.current;
    const lookAtGoal = lookAtGoalRef.current;

    // ── Intro fly-in ────────────────────────────────
    if (!introComplete) {
      // Compute desired intro camera position from the INTRO constants
      const introPos = cameraPositionFromLookAt(
        INTRO_LOOK_AT,
        INTRO_HEIGHT,
        _desiredPos.current,
      );
      camera.position.lerp(introPos, INTRO_LERP_SPEED);
      lookAt.lerp(INTRO_LOOK_AT, INTRO_LERP_SPEED);
      camera.lookAt(lookAt);

      if (camera.position.distanceTo(introPos) < 0.1) {
        setIntroComplete(true);
        lookAtGoal.copy(INTRO_LOOK_AT);
        lookAt.copy(INTRO_LOOK_AT);
        heightRef.current = INTRO_HEIGHT;
        heightGoalRef.current = INTRO_HEIGHT;
      }

      // Update shared look-at for getCameraLookAt()
      _currentLookAt.copy(lookAt);
      return;
    }

    // ── Focus target animation (from minimap / search) ──
    if (focusTarget) {
      // Animate the look-at goal toward the focus target on XZ, keep Y=0
      lookAtGoal.set(focusTarget.x, 0, focusTarget.z);

      // Kill any residual drag velocity so inertia doesn't fight the
      // focus animation or push the camera away after it completes.
      dragVelocityRef.current.set(0, 0);

      // When close enough, snap and clear
      if (lookAt.distanceTo(lookAtGoal) < 0.1) {
        lookAt.copy(lookAtGoal);
        clearFocusTarget();
      }
    }

    // ── Keyboard panning ────────────────────────────
    if (controlsEnabled) {
      const keys = keysRef.current;
      const speed = KEY_PAN_SPEED * delta * (heightRef.current / 20);
      if (keys.has('w') || keys.has('arrowup')) lookAtGoal.z -= speed;
      if (keys.has('s') || keys.has('arrowdown')) lookAtGoal.z += speed;
      if (keys.has('a') || keys.has('arrowleft')) lookAtGoal.x -= speed;
      if (keys.has('d') || keys.has('arrowright')) lookAtGoal.x += speed;
    }

    // ── Apply drag inertia when not actively dragging ──
    // Guard with controlsEnabled so inertia doesn't drift the camera
    // during selection-box drags or file-drag operations.
    if (!isDraggingRef.current && controlsEnabledRef.current) {
      const vel = dragVelocityRef.current;
      if (vel.lengthSq() > 0.0001) {
        // Decay the velocity
        vel.multiplyScalar(0.92);
        lookAtGoal.x += vel.x * delta * 2;
        lookAtGoal.z += vel.y * delta * 2;
      } else {
        vel.set(0, 0);
      }
    }

    // ── Damped interpolation ────────────────────────
    // When controls are disabled (selection/drag in progress) and no
    // focus animation is running, freeze the camera to prevent drift
    // from residual damping. This keeps the projected file positions
    // stable so the selection rectangle matches what the user sees.
    if (controlsEnabledRef.current || focusTarget) {
      lookAt.lerp(lookAtGoal, DAMPING);
      heightRef.current = THREE.MathUtils.lerp(
        heightRef.current,
        heightGoalRef.current,
        DAMPING,
      );
    } else {
      // Keep goal in sync with frozen position to avoid a camera jump
      // when controls are re-enabled.
      lookAtGoal.copy(lookAt);
      heightGoalRef.current = heightRef.current;
    }

    // ── Position the camera ─────────────────────────
    cameraPositionFromLookAt(lookAt, heightRef.current, camera.position);
    camera.lookAt(lookAt);

    // ── Sync shared look-at for getCameraLookAt() ───
    _currentLookAt.copy(lookAt);
  });

  return null;
}
