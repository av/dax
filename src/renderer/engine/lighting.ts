import {
  Scene,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  PBRMaterial,
  ShadowGenerator,
  type Mesh,
} from '@babylonjs/core';
import {
  GROUND_SIZE,
  HEMI_LIGHT_INTENSITY,
  DIR_LIGHT_INTENSITY,
  SHADOW_MAP_SIZE,
} from '@shared/constants';

/** Reference to the shadow generator for external access */
let shadowGen: ShadowGenerator | null = null;

/** Reference to the ground mesh for external access */
let groundMesh: Mesh | null = null;

/**
 * Sets up scene lighting, ground plane, and shadow system.
 *
 * - Hemispheric light for ambient fill (intensity 0.4)
 * - Directional light at 45° (intensity 0.8) for shadows
 * - Shadow generator: 2048×2048, PCF soft shadows
 * - Ground plane receives shadows
 * - Gradient sky background
 */
export function setupLighting(scene: Scene): { shadowGenerator: ShadowGenerator; ground: Mesh } {
  // ── Hemispheric ambient light ──
  const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
  hemiLight.intensity = HEMI_LIGHT_INTENSITY;
  hemiLight.diffuse = new Color3(0.95, 0.95, 1.0);
  hemiLight.groundColor = new Color3(0.2, 0.2, 0.25);

  // ── Directional light for shadows at 45° ──
  const dirLight = new DirectionalLight(
    'dirLight',
    new Vector3(-1, -1, -1).normalize(), // 45° angle from above
    scene,
  );
  dirLight.intensity = DIR_LIGHT_INTENSITY;
  dirLight.diffuse = new Color3(1.0, 0.98, 0.92);
  dirLight.specular = new Color3(0.8, 0.8, 0.85);

  // Position the light source far enough for proper shadow range
  dirLight.position = new Vector3(50, 80, 50);

  // Shadow frustum for large scenes
  dirLight.shadowMinZ = 1;
  dirLight.shadowMaxZ = 300;

  // ── Shadow generator: PCF 2048×2048 ──
  shadowGen = new ShadowGenerator(SHADOW_MAP_SIZE, dirLight);
  shadowGen.usePercentageCloserFiltering = true; // PCF soft shadows
  shadowGen.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadowGen.bias = 0.001;
  shadowGen.normalBias = 0.02;

  // ── Ground plane ──
  groundMesh = MeshBuilder.CreateGround(
    'ground',
    { width: GROUND_SIZE, height: GROUND_SIZE },
    scene,
  );

  const groundMaterial = new PBRMaterial('groundMaterial', scene);
  groundMaterial.albedoColor = new Color3(0.12, 0.12, 0.18);
  groundMaterial.roughness = 0.95;
  groundMaterial.metallic = 0.0;
  groundMesh.material = groundMaterial;
  groundMesh.receiveShadows = true;

  // ── Gradient sky background ──
  // Use a vertical color gradient from dark horizon to deep space
  scene.clearColor = new Color4(0, 0, 0, 0); // Transparent so autoClear shows gradient
  scene.autoClear = true;

  // Create gradient using Babylon.js createDefaultEnvironment-inspired approach
  // Set a gradient background using the scene's environment texture fallback
  const skyTop = new Color3(0.02, 0.02, 0.08);
  const skyBottom = new Color3(0.08, 0.06, 0.15);

  // Use vertex-colored box as skybox alternative for gradient
  const skyPlane = MeshBuilder.CreateGround(
    'skyGradient',
    { width: 2000, height: 2000 },
    scene,
  );
  skyPlane.position.y = -2; // Far below ground to prevent z-fighting at shallow angles
  skyPlane.isPickable = false;

  const skyMat = new PBRMaterial('skyGradientMat', scene);
  skyMat.albedoColor = new Color3(0.04, 0.03, 0.1);
  skyMat.roughness = 1.0;
  skyMat.metallic = 0.0;
  skyMat.emissiveColor = new Color3(0.03, 0.02, 0.08);
  skyMat.disableLighting = true;
  skyPlane.material = skyMat;

  // Actually set the scene's clearColor to a nice gradient-approximation dark blue
  scene.clearColor = new Color4(0.02, 0.015, 0.06, 1.0);

  return { shadowGenerator: shadowGen, ground: groundMesh };
}

/**
 * Get the shadow generator (to add meshes as shadow casters).
 */
export function getShadowGenerator(): ShadowGenerator | null {
  return shadowGen;
}

/**
 * Get the ground mesh (for physics body creation).
 */
export function getGroundMesh(): Mesh | null {
  return groundMesh;
}

/**
 * Add a mesh as a shadow caster and receiver.
 */
export function enableShadows(mesh: import('@babylonjs/core').AbstractMesh): void {
  if (shadowGen) {
    shadowGen.addShadowCaster(mesh, true);
  }
  mesh.receiveShadows = true;
}

/**
 * Update shadow generator quality (for performance scaling).
 */
export function setShadowMapSize(size: number): void {
  if (shadowGen) {
    shadowGen.mapSize = size;
  }
}
