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

/** Number of consecutive fast frames required to recover one shadow quality level (~2s at 60fps) */
const RECOVERY_FRAME_THRESHOLD = 120;

let currentShadowQualityIndex = 0;
let consecutiveSlowFrames = 0;
let consecutiveFastFrames = 0;
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
      consecutiveFastFrames = 0; // Reset fast streak

      if (consecutiveSlowFrames >= PERF_CONSECUTIVE_SLOW_FRAMES) {
        reduceShadowQuality();
        consecutiveSlowFrames = 0; // Reset counter after adjustment
      }
    } else {
      // Reset slow streak if we have a good frame
      consecutiveSlowFrames = 0;
      consecutiveFastFrames++;

      if (consecutiveFastFrames >= RECOVERY_FRAME_THRESHOLD) {
        increaseShadowQuality();
        consecutiveFastFrames = 0; // Reset counter after adjustment
      }
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
 * Increase shadow map quality by one level.
 * Goes through: 256 → 512 → 1024 → 2048.
 * Does nothing if already at maximum quality.
 */
function increaseShadowQuality(): void {
  if (!shadowGenerator) return;

  if (currentShadowQualityIndex <= 0) {
    // Already at highest quality — nothing more to do
    return;
  }

  currentShadowQualityIndex--;
  const newSize = SHADOW_QUALITY_LEVELS[currentShadowQualityIndex];

  const shadowMap = shadowGenerator.getShadowMap();
  if (shadowMap) {
    shadowMap.refreshRate = 1;
  }

  shadowGenerator.mapSize = newSize;

  console.log(`[perf] Shadow quality increased to ${newSize}x${newSize}`);
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
  consecutiveFastFrames = 0;
}
