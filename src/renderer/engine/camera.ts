/**
 * RTS-style camera controls for the 3D scene.
 *
 * Controls:
 * - Middle mouse drag → pan (translate along XZ plane)
 * - Mouse scroll wheel → zoom (clamped min 5, max 200)
 * - Shift + middle mouse → rotate (orbit around focal point)
 * - Edge scroll: mouse near screen edges pans camera
 * - Keyboard: WASD/arrows for pan, Q/E for rotation
 * - Home key resets camera to default overhead view
 * - Smooth camera movement with inertia
 */
import {
  ArcRotateCamera,
  Vector3,
  type Scene,
  type Engine,
  KeyboardEventTypes,
  Animation,
  CubicEase,
  EasingFunction,
} from '@babylonjs/core';
import {
  CAMERA_DEFAULT_ALPHA,
  CAMERA_DEFAULT_BETA,
  CAMERA_DEFAULT_RADIUS,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  EDGE_SCROLL_ZONE_PX,
  EDGE_SCROLL_SPEED,
  CAMERA_PAN_SPEED,
  CAMERA_ROTATE_SPEED,
  CAMERA_INERTIA,
} from '@shared/constants';
import { cameraState, setCameraState, type CameraState } from '../state/camera';
import { appConfig } from '../state/config';

let camera: ArcRotateCamera | null = null;
let canvas: HTMLCanvasElement | null = null;
let isMiddleMouseDown = false;
let isShiftHeld = false;
let lastPointerX = 0;
let lastPointerY = 0;
let edgeScrollActive = false;

/** Keys currently pressed (for continuous movement) */
const keysPressed = new Set<string>();

/** Camera persistence save debounce timer */
let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Callback for persisting camera state to DB */
let cameraPersistCallback: ((state: CameraState) => void) | null = null;

/**
 * Create and configure the RTS camera.
 */
export function createRTSCamera(
  scene: Scene,
  canvasEl: HTMLCanvasElement,
): ArcRotateCamera {
  canvas = canvasEl;

  camera = new ArcRotateCamera(
    'rtsCamera',
    CAMERA_DEFAULT_ALPHA,
    CAMERA_DEFAULT_BETA,
    CAMERA_DEFAULT_RADIUS,
    Vector3.Zero(),
    scene,
  );

  // Clamp zoom range
  camera.lowerRadiusLimit = CAMERA_ZOOM_MIN;
  camera.upperRadiusLimit = CAMERA_ZOOM_MAX;

  // Clamp vertical rotation to prevent flipping under ground
  camera.lowerBetaLimit = 0.1;
  camera.upperBetaLimit = Math.PI / 2 - 0.05;

  // Enable inertia for smooth movement
  camera.inertia = CAMERA_INERTIA;

  // Zoom speed
  camera.wheelPrecision = 10;

  // Disable default inputs — we manage them ourselves
  camera.inputs.clear();

  // Re-add only the mousewheel input for zoom
  camera.inputs.addMouseWheel();

  // Attach camera to canvas (only mousewheel will be processed by default inputs)
  camera.attachControl(canvasEl, true);

  // Set up custom pointer handlers
  setupPointerHandlers(scene, canvasEl);

  // Set up keyboard handlers
  setupKeyboardHandlers(scene);

  // Set up edge scroll (in render loop)
  setupEdgeScroll(scene);

  return camera;
}

/**
 * Restore camera state from previously saved state.
 */
export function restoreCameraState(state: CameraState): void {
  if (!camera) return;
  camera.alpha = state.alpha;
  camera.beta = state.beta;
  camera.radius = state.radius;
  camera.target.set(state.targetX, state.targetY, state.targetZ);
}

/**
 * Reset camera to default overhead view.
 */
export function resetCameraToDefault(): void {
  if (!camera) return;
  camera.alpha = CAMERA_DEFAULT_ALPHA;
  camera.beta = CAMERA_DEFAULT_BETA;
  camera.radius = CAMERA_DEFAULT_RADIUS;
  camera.target.set(0, 0, 0);
  saveCameraState();
}

/**
 * Get the current ArcRotateCamera instance.
 */
export function getCamera(): ArcRotateCamera | null {
  return camera;
}

/**
 * Register a callback for camera state persistence (called on state changes, debounced).
 */
export function onCameraStateChange(callback: (state: CameraState) => void): void {
  cameraPersistCallback = callback;
}

/**
 * Save the current camera state to the signal store (and trigger persistence).
 */
function saveCameraState(): void {
  if (!camera) return;

  const state: CameraState = {
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
    targetX: camera.target.x,
    targetY: camera.target.y,
    targetZ: camera.target.z,
  };

  setCameraState(state);

  // Debounced persistence to DB
  if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
  cameraSaveTimer = setTimeout(() => {
    cameraPersistCallback?.(state);
  }, 500);
}

// ── Pointer Handlers ──

function setupPointerHandlers(scene: Scene, canvasEl: HTMLCanvasElement): void {
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // Track shift key state
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') isShiftHeld = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') isShiftHeld = false;
  });
}

function onPointerDown(e: PointerEvent): void {
  // Middle mouse button (1)
  if (e.button === 1) {
    isMiddleMouseDown = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    e.preventDefault();
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!isMiddleMouseDown || !camera) return;

  const dx = e.clientX - lastPointerX;
  const dy = e.clientY - lastPointerY;
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;

  if (isShiftHeld) {
    // Shift + middle mouse → orbit (rotate)
    camera.alpha -= dx * 0.005;
    camera.beta -= dy * 0.005;

    // Clamp beta
    camera.beta = Math.max(camera.lowerBetaLimit!, Math.min(camera.upperBetaLimit!, camera.beta));
  } else {
    // Middle mouse → pan (translate target along XZ plane)
    const panSpeed = camera.radius * 0.002;
    const cosAlpha = Math.cos(camera.alpha);
    const sinAlpha = Math.sin(camera.alpha);

    // Pan relative to camera orientation
    camera.target.x += (-dx * cosAlpha + dy * sinAlpha) * panSpeed;
    camera.target.z += (dx * sinAlpha + dy * cosAlpha) * panSpeed;
  }

  saveCameraState();
}

function onPointerUp(e: PointerEvent): void {
  if (e.button === 1) {
    isMiddleMouseDown = false;
  }
}

// ── Keyboard Handlers ──

function setupKeyboardHandlers(scene: Scene): void {
  scene.onKeyboardObservable.add((info) => {
    const key = info.event.key.toLowerCase();

    if (info.type === KeyboardEventTypes.KEYDOWN) {
      keysPressed.add(key);

      // Home key — instant reset
      if (info.event.key === 'Home') {
        resetCameraToDefault();
      }
    } else if (info.type === KeyboardEventTypes.KEYUP) {
      keysPressed.delete(key);
    }
  });

  // Process keyboard pan/rotate each frame
  scene.onBeforeRenderObservable.add(() => {
    if (!camera) return;
    if (keysPressed.size === 0) return;

    // Don't process camera keys when a text input is focused
    const activeTag = document.activeElement?.tagName;
    if (
      activeTag === 'INPUT' ||
      activeTag === 'TEXTAREA' ||
      (document.activeElement as HTMLElement)?.contentEditable === 'true'
    ) return;

    let moved = false;
    const panSpeed = CAMERA_PAN_SPEED * (camera.radius * 0.02);
    const cosAlpha = Math.cos(camera.alpha);
    const sinAlpha = Math.sin(camera.alpha);

    // WASD / Arrows for pan
    if (keysPressed.has('w') || keysPressed.has('arrowup')) {
      camera.target.x += sinAlpha * panSpeed;
      camera.target.z += cosAlpha * panSpeed;
      moved = true;
    }
    if (keysPressed.has('s') || keysPressed.has('arrowdown')) {
      camera.target.x -= sinAlpha * panSpeed;
      camera.target.z -= cosAlpha * panSpeed;
      moved = true;
    }
    if (keysPressed.has('a') || keysPressed.has('arrowleft')) {
      camera.target.x += cosAlpha * panSpeed;
      camera.target.z -= sinAlpha * panSpeed;
      moved = true;
    }
    if (keysPressed.has('d') || keysPressed.has('arrowright')) {
      camera.target.x -= cosAlpha * panSpeed;
      camera.target.z += sinAlpha * panSpeed;
      moved = true;
    }

    // Q/E for rotation
    if (keysPressed.has('q')) {
      camera.alpha -= CAMERA_ROTATE_SPEED;
      moved = true;
    }
    if (keysPressed.has('e')) {
      camera.alpha += CAMERA_ROTATE_SPEED;
      moved = true;
    }

    if (moved) {
      saveCameraState();
    }
  });
}

// ── Edge Scroll ──

function setupEdgeScroll(scene: Scene): void {
  let mouseX = 0;
  let mouseY = 0;
  let mouseHasMoved = false;

  canvas?.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseHasMoved = true;
  });

  canvas?.addEventListener('mouseleave', () => {
    mouseHasMoved = false;
  });

  scene.onBeforeRenderObservable.add(() => {
    if (!camera || !canvas) return;
    if (!appConfig.edgeScrollEnabled) return;
    if (!mouseHasMoved) return;

    const rect = canvas.getBoundingClientRect();
    const zone = EDGE_SCROLL_ZONE_PX;
    const speed = EDGE_SCROLL_SPEED * (camera.radius * 0.01);

    const cosAlpha = Math.cos(camera.alpha);
    const sinAlpha = Math.sin(camera.alpha);

    let moved = false;

    // Left edge
    if (mouseX - rect.left < zone && mouseX >= rect.left) {
      camera.target.x += cosAlpha * speed;
      camera.target.z -= sinAlpha * speed;
      moved = true;
    }
    // Right edge
    if (rect.right - mouseX < zone && mouseX <= rect.right) {
      camera.target.x -= cosAlpha * speed;
      camera.target.z += sinAlpha * speed;
      moved = true;
    }
    // Top edge
    if (mouseY - rect.top < zone && mouseY >= rect.top) {
      camera.target.x += sinAlpha * speed;
      camera.target.z += cosAlpha * speed;
      moved = true;
    }
    // Bottom edge
    if (rect.bottom - mouseY < zone && mouseY <= rect.bottom) {
      camera.target.x -= sinAlpha * speed;
      camera.target.z -= cosAlpha * speed;
      moved = true;
    }

    if (moved) {
      saveCameraState();
    }
  });
}

/**
 * Smoothly animate the camera to look at a specific world position.
 * Used by search result click → camera flies to that object.
 */
export function flyToPosition(
  target: { x: number; y: number; z: number },
  scene: Scene,
  onComplete?: () => void,
): void {
  if (!camera) return;

  const duration = 40; // frames at 60fps (~667ms)
  const ease = new CubicEase();
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

  // Animate camera target
  const targetXAnim = new Animation('flyTargetX', 'target.x', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
  targetXAnim.setKeys([{ frame: 0, value: camera.target.x }, { frame: duration, value: target.x }]);
  targetXAnim.setEasingFunction(ease);

  const targetZAnim = new Animation('flyTargetZ', 'target.z', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
  targetZAnim.setKeys([{ frame: 0, value: camera.target.z }, { frame: duration, value: target.z }]);
  targetZAnim.setEasingFunction(ease);

  // Optionally zoom in a bit
  const zoomTarget = Math.min(camera.radius, 25);
  const radiusAnim = new Animation('flyRadius', 'radius', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
  radiusAnim.setKeys([{ frame: 0, value: camera.radius }, { frame: duration, value: zoomTarget }]);
  radiusAnim.setEasingFunction(ease);

  scene.beginDirectAnimation(
    camera,
    [targetXAnim, targetZAnim, radiusAnim],
    0,
    duration,
    false,
    1.0,
    () => {
      saveCameraState();
      onComplete?.();
    },
  );
}

/**
 * Dispose camera and cleanup event listeners.
 */
export function disposeCamera(): void {
  if (canvas) {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
  }
  if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
  camera = null;
  canvas = null;
  keysPressed.clear();
  cameraPersistCallback = null;
}
