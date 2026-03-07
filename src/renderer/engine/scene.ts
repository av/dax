import {
  Engine,
  Scene,
  Vector3,
} from '@babylonjs/core';
import { setupLighting, getShadowGenerator, getGroundMesh } from './lighting';
import { initPhysics, createGroundBody, createBoundaryWalls } from './physics';
import { createRTSCamera, restoreCameraState } from './camera';
import { startPerformanceMonitor } from './performance-monitor';
import { verifyFrustumCulling } from './lod';
import { TARGET_RENDER_FPS } from '@shared/constants';
import type { CameraState } from '../state/camera';

let engine: Engine | null = null;
let scene: Scene | null = null;

let resolveSceneReady: () => void;

/** Promise that resolves once initScene() has fully completed. */
export const sceneReady: Promise<void> = new Promise((resolve) => {
  resolveSceneReady = resolve;
});

/**
 * Initializes the Babylon.js engine and scene with full M4 features:
 * - Engine with MSAA 4x anti-aliasing, device pixel ratio matching
 * - Scene with gradient sky background
 * - Havok physics plugin (WASM) with gravity
 * - RTS-style camera (pan/zoom/rotate/edge scroll)
 * - Hemispheric + directional lighting with PCF shadow generator
 * - Ground plane with static physics body
 * - Invisible boundary walls
 * - Performance monitoring with auto shadow quality reduction
 * - Frustum culling verification
 * - Render loop + resize handler
 */
export async function initScene(
  canvas: HTMLCanvasElement,
  savedCameraState?: CameraState,
): Promise<{ engine: Engine; scene: Scene }> {
  // Create engine with MSAA 4x anti-aliasing
  engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
    adaptToDeviceRatio: true, // Match device pixel ratio
  });

  // Enable MSAA 4x
  engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

  // Create scene
  scene = new Scene(engine);

  // ── Lighting, ground plane, shadows ──
  const { shadowGenerator, ground } = setupLighting(scene);

  // ── Havok Physics initialization ──
  await initPhysics(scene);

  // Ground plane gets a static physics body
  createGroundBody(ground, scene);

  // Create invisible boundary walls around the scene
  createBoundaryWalls(scene);

  // ── RTS Camera ──
  const camera = createRTSCamera(scene, canvas);

  // Restore saved camera state if available
  if (savedCameraState) {
    restoreCameraState(savedCameraState);
  }

  // ── Performance monitor ──
  startPerformanceMonitor(engine, scene, shadowGenerator);

  // ── Frustum culling verification ──
  // Babylon.js enables this by default, verify it's active
  scene.onAfterRenderObservable.addOnce(() => {
    const cullingActive = verifyFrustumCulling(scene!);
    if (!cullingActive) {
      console.warn('[scene] Frustum culling appears disabled on some meshes');
    }
  });

  // ── Render loop (capped to TARGET_RENDER_FPS) ──
  const frameTimeMs = 1000 / TARGET_RENDER_FPS;
  let lastRenderTime = performance.now();

  engine.runRenderLoop(() => {
    const now = performance.now();
    const elapsed = now - lastRenderTime;
    if (elapsed < frameTimeMs) return;
    // Subtract leftover to keep cadence steady and avoid drift
    lastRenderTime = now - (elapsed % frameTimeMs);
    scene!.render();
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    engine!.resize();
  });

  resolveSceneReady();

  return { engine, scene };
}

/** Get the current Babylon.js Engine instance */
export function getEngine(): Engine | null {
  return engine;
}

/** Get the current Babylon.js Scene instance */
export function getScene(): Scene | null {
  return scene;
}
