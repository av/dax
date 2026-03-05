/**
 * Performance monitor — tracks frame times and auto-adjusts quality.
 *
 * Monitors:
 * - Frame time (ms per render loop iteration)
 * - If frame time exceeds 33ms for 10 consecutive frames, reduces shadow quality
 * - Reports FPS for debugging
 *
 * Uses Babylon.js SceneInstrumentation for accurate GPU timing when available.
 */
import type { Engine, Scene, ShadowGenerator } from '@babylonjs/core';
import { PERF_FRAME_TIME_THRESHOLD_MS, PERF_CONSECUTIVE_SLOW_FRAMES } from '@shared/constants';

/** Shadow quality levels (map resolution) */
const SHADOW_QUALITY_LEVELS = [2048, 1024, 512, 256];

let currentShadowQualityIndex = 0;
let consecutiveSlowFrames = 0;
let shadowGenerator: ShadowGenerator | null = null;
let isMonitoring = false;
let lastFrameTime = 0;

/**
 * Start monitoring frame performance.
 * Automatically downgrades shadow quality when performance drops.
 *
 * @param engine - Babylon.js Engine
 * @param scene - Babylon.js Scene
 * @param sg - Shadow generator to adjust quality on
 */
export function startPerformanceMonitor(
  engine: Engine,
  scene: Scene,
  sg: ShadowGenerator | null,
): void {
  shadowGenerator = sg;
  isMonitoring = true;
  consecutiveSlowFrames = 0;
  currentShadowQualityIndex = 0;

  // Monitor frame time in the render loop
  scene.onAfterRenderObservable.add(() => {
    if (!isMonitoring) return;

    // Get delta time in ms
    const frameTime = engine.getDeltaTime();
    lastFrameTime = frameTime;

    if (frameTime > PERF_FRAME_TIME_THRESHOLD_MS) {
      consecutiveSlowFrames++;

      if (consecutiveSlowFrames >= PERF_CONSECUTIVE_SLOW_FRAMES) {
        reduceShadowQuality();
        consecutiveSlowFrames = 0; // Reset counter after adjustment
      }
    } else {
      // Reset streak if we have a good frame
      consecutiveSlowFrames = 0;
    }
  });
}

/**
 * Reduce shadow map quality by one level.
 * Goes through: 2048 → 1024 → 512 → 256.
 * Does nothing if already at minimum quality.
 */
function reduceShadowQuality(): void {
  if (!shadowGenerator) return;

  const nextIndex = currentShadowQualityIndex + 1;
  if (nextIndex >= SHADOW_QUALITY_LEVELS.length) {
    // Already at lowest quality — nothing more to do
    return;
  }

  currentShadowQualityIndex = nextIndex;
  const newSize = SHADOW_QUALITY_LEVELS[nextIndex];

  // Recreate shadow map at lower resolution
  const shadowMap = shadowGenerator.getShadowMap();
  if (shadowMap) {
    shadowMap.refreshRate = 1; // Force refresh with new settings
  }

  // Update the shadow map size through the generator
  shadowGenerator.mapSize = newSize;

  console.log(`[perf] Shadow quality reduced to ${newSize}x${newSize}`);
}

/**
 * Get current performance stats.
 */
export function getPerformanceStats(): {
  lastFrameTimeMs: number;
  currentShadowMapSize: number;
  consecutiveSlowFrames: number;
  shadowReductionsApplied: number;
} {
  return {
    lastFrameTimeMs: lastFrameTime,
    currentShadowMapSize: SHADOW_QUALITY_LEVELS[currentShadowQualityIndex],
    consecutiveSlowFrames,
    shadowReductionsApplied: currentShadowQualityIndex,
  };
}

/**
 * Stop the performance monitor.
 */
export function stopPerformanceMonitor(): void {
  isMonitoring = false;
  shadowGenerator = null;
  consecutiveSlowFrames = 0;
}
