/**
 * Animation library for scene objects.
 *
 * Provides reusable animation functions:
 * - fadeIn: new object appears (scale 0→1 + opacity 0→1)
 * - dissolve: object removed (scale 1→0 + opacity 1→0)
 * - pulse: object modified (brief glow/scale bump)
 * - popIn: object appears with bouncy spring
 * - renameFlash: label update flash effect
 */
import {
  Animation,
  AbstractMesh,
  type Scene,
  EasingFunction,
  CubicEase,
  BounceEase,
  type TransformNode,
} from '@babylonjs/core';

/** Duration constants (in frames at 60fps) */
const FADE_IN_FRAMES = 20;
const DISSOLVE_FRAMES = 15;
const PULSE_FRAMES = 30;
const RENAME_FLASH_FRAMES = 20;

/**
 * Resolve the actual renderable mesh from a node.
 * If the node is a TransformNode (not an AbstractMesh), returns the first child mesh.
 * Visibility animations must target an AbstractMesh, not a TransformNode.
 */
function resolveRenderMesh(node: AbstractMesh | TransformNode): AbstractMesh | null {
  if (node instanceof AbstractMesh) return node;
  const children = node.getChildMeshes(false);
  return children.length > 0 ? children[0] : null;
}

/**
 * Fade-in animation: mesh scales from 0 to 1 and becomes visible.
 * Used when new files appear.
 * Accepts a TransformNode or AbstractMesh — visibility is applied to the child mesh.
 */
export function fadeIn(mesh: AbstractMesh | TransformNode, scene: Scene, onComplete?: () => void): void {
  const renderTarget = resolveRenderMesh(mesh);
  mesh.scaling.setAll(0);
  if (renderTarget) renderTarget.visibility = 0;

  const scaleAnim = new Animation(
    'fadeInScale',
    'scaling.x',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );

  const ease = new CubicEase();
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

  scaleAnim.setKeys([
    { frame: 0, value: 0 },
    { frame: FADE_IN_FRAMES, value: 1 },
  ]);
  scaleAnim.setEasingFunction(ease);

  const visAnim = new Animation(
    'fadeInVis',
    'visibility',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  visAnim.setKeys([
    { frame: 0, value: 0 },
    { frame: FADE_IN_FRAMES, value: 1 },
  ]);
  visAnim.setEasingFunction(ease);

  // Apply to all axes
  const scaleY = scaleAnim.clone();
  scaleY.targetProperty = 'scaling.y';
  const scaleZ = scaleAnim.clone();
  scaleZ.targetProperty = 'scaling.z';

  // Scale animation targets the node (TransformNode or Mesh)
  scene.beginDirectAnimation(
    mesh,
    [scaleAnim, scaleY, scaleZ],
    0,
    FADE_IN_FRAMES,
    false,
  );

  // Visibility animation targets the actual renderable mesh
  if (renderTarget && renderTarget !== mesh) {
    scene.beginDirectAnimation(
      renderTarget,
      [visAnim],
      0,
      FADE_IN_FRAMES,
      false,
      1.0,
      onComplete,
    );
  } else {
    scene.beginDirectAnimation(
      mesh,
      [visAnim],
      0,
      FADE_IN_FRAMES,
      false,
      1.0,
      onComplete,
    );
  }
}

/**
 * Dissolve animation: mesh scales to 0 and fades out.
 * Used when files are deleted.
 * Calls onComplete when done (caller should dispose the mesh).
 * Accepts a TransformNode or AbstractMesh.
 */
export function dissolve(mesh: AbstractMesh | TransformNode, scene: Scene, onComplete?: () => void): void {
  const renderTarget = resolveRenderMesh(mesh);
  const ease = new CubicEase();
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEIN);

  const scaleAnim = new Animation(
    'dissolveScale',
    'scaling.x',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  scaleAnim.setKeys([
    { frame: 0, value: mesh.scaling.x },
    { frame: DISSOLVE_FRAMES, value: 0 },
  ]);
  scaleAnim.setEasingFunction(ease);

  const visAnim = new Animation(
    'dissolveVis',
    'visibility',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  visAnim.setKeys([
    { frame: 0, value: 1 },
    { frame: DISSOLVE_FRAMES, value: 0 },
  ]);
  visAnim.setEasingFunction(ease);

  const scaleY = scaleAnim.clone();
  scaleY.targetProperty = 'scaling.y';
  const scaleZ = scaleAnim.clone();
  scaleZ.targetProperty = 'scaling.z';

  // Scale animation on the node
  scene.beginDirectAnimation(
    mesh,
    [scaleAnim, scaleY, scaleZ],
    0,
    DISSOLVE_FRAMES,
    false,
  );

  // Visibility animation on the renderable mesh
  if (renderTarget && renderTarget !== mesh) {
    scene.beginDirectAnimation(
      renderTarget,
      [visAnim],
      0,
      DISSOLVE_FRAMES,
      false,
      1.0,
      onComplete,
    );
  } else {
    scene.beginDirectAnimation(
      mesh,
      [visAnim],
      0,
      DISSOLVE_FRAMES,
      false,
      1.0,
      onComplete,
    );
  }
}

/**
 * Pulse animation: mesh briefly scales up and glows.
 * Used when files are modified.
 * Accepts a TransformNode or AbstractMesh.
 */
export function pulse(mesh: AbstractMesh | TransformNode, scene: Scene, onComplete?: () => void): void {
  const ease = new BounceEase(1, 4);
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

  const scaleAnim = new Animation(
    'pulseScale',
    'scaling.x',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );

  const baseScale = mesh.scaling.x;
  scaleAnim.setKeys([
    { frame: 0, value: baseScale },
    { frame: 10, value: baseScale * 1.15 },
    { frame: PULSE_FRAMES, value: baseScale },
  ]);
  scaleAnim.setEasingFunction(ease);

  const scaleY = scaleAnim.clone();
  scaleY.targetProperty = 'scaling.y';
  const scaleZ = scaleAnim.clone();
  scaleZ.targetProperty = 'scaling.z';

  scene.beginDirectAnimation(
    mesh,
    [scaleAnim, scaleY, scaleZ],
    0,
    PULSE_FRAMES,
    false,
    1.0,
    onComplete,
  );
}

/**
 * Rename flash animation: brief visibility flicker.
 * Used when files are renamed (label update).
 * Accepts a TransformNode or AbstractMesh — visibility targets the child mesh.
 */
export function renameFlash(mesh: AbstractMesh | TransformNode, scene: Scene, onComplete?: () => void): void {
  const renderTarget = resolveRenderMesh(mesh);
  const target = renderTarget ?? mesh;

  const visAnim = new Animation(
    'renameVis',
    'visibility',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  visAnim.setKeys([
    { frame: 0, value: 1 },
    { frame: 5, value: 0.3 },
    { frame: 10, value: 1 },
    { frame: 15, value: 0.5 },
    { frame: RENAME_FLASH_FRAMES, value: 1 },
  ]);

  scene.beginDirectAnimation(
    target,
    [visAnim],
    0,
    RENAME_FLASH_FRAMES,
    false,
    1.0,
    onComplete,
  );
}

// ── Agent animations ──

/** Duration for agent search scan ring (frames at 60fps) */
const SEARCH_SCAN_FRAMES = 40;

/**
 * Search scan animation: expanding ring effect.
 * Creates a temporary ring mesh that scales up and fades out.
 * Used when the agent performs a search operation.
 */
export function searchScan(
  mesh: AbstractMesh,
  scene: Scene,
  onComplete?: () => void,
): void {
  const scaleAnim = new Animation(
    'searchScanScale',
    'scaling.x',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );

  scaleAnim.setKeys([
    { frame: 0, value: 1 },
    { frame: SEARCH_SCAN_FRAMES, value: 3 },
  ]);

  const visAnim = new Animation(
    'searchScanVis',
    'visibility',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  visAnim.setKeys([
    { frame: 0, value: 0.8 },
    { frame: SEARCH_SCAN_FRAMES, value: 0 },
  ]);

  const scaleY = scaleAnim.clone();
  scaleY.targetProperty = 'scaling.y';
  const scaleZ = scaleAnim.clone();
  scaleZ.targetProperty = 'scaling.z';

  scene.beginDirectAnimation(
    mesh,
    [scaleAnim, scaleY, scaleZ, visAnim],
    0,
    SEARCH_SCAN_FRAMES,
    false,
    1.0,
    onComplete,
  );
}
