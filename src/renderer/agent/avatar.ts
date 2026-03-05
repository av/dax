/**
 * Agent avatar: procedural mesh (capsule body + sphere head),
 * movement, and state animations.
 *
 * The avatar is the agent's physical representation in the 3D scene.
 * - Body: cylinder + hemisphere caps (capsule shape)
 * - Head: sphere on top
 * - Status indicator: colored sphere above head that changes color by state
 * - Kinematic physics body (not affected by external forces)
 * - Smooth movement via animation to target positions
 */
import {
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  TransformNode,
  Animation,
  EasingFunction,
  CubicEase,
  type Scene,
  type Mesh,
} from '@babylonjs/core';
import type { AgentStatus } from '@shared/events';

/** Avatar configuration */
const BODY_HEIGHT = 1.2;
const BODY_RADIUS = 0.35;
const HEAD_RADIUS = 0.3;
const INDICATOR_RADIUS = 0.12;
const INDICATOR_Y_OFFSET = 0.5;
const AVATAR_COLOR = new Color3(0, 0.8, 0.8); // Teal/cyan
const AVATAR_HOVER_Y = 0.8; // Float slightly above ground

/** Status indicator colors */
const STATUS_COLORS: Record<AgentStatus, Color3> = {
  idle: new Color3(0.3, 0.3, 0.8), // Blue — 💤
  thinking: new Color3(0.9, 0.7, 0.1), // Yellow — 🤔
  acting: new Color3(0.1, 0.9, 0.2), // Green — 🏃
  learning: new Color3(0.7, 0.3, 0.9), // Purple — 📚
  paused: new Color3(0.5, 0.5, 0.5), // Gray
};

export interface AgentAvatar {
  /** The root transform node containing all avatar parts */
  root: TransformNode;
  /** The body mesh */
  body: Mesh;
  /** The head mesh */
  head: Mesh;
  /** Status indicator sphere */
  indicator: Mesh;
  /** Current status */
  status: AgentStatus;
  /** Whether the avatar is currently moving */
  isMoving: boolean;
}

let avatar: AgentAvatar | null = null;

/**
 * Create the agent avatar in the scene.
 * Returns the avatar object for direct manipulation.
 */
export function createAgentAvatar(scene: Scene, initialPosition?: { x: number; z: number }): AgentAvatar {
  if (avatar) {
    // Already created, return existing
    return avatar;
  }

  // Root transform node
  const root = new TransformNode('agent-avatar-root', scene);
  const x = initialPosition?.x ?? 0;
  const z = initialPosition?.z ?? 0;
  root.position = new Vector3(x, AVATAR_HOVER_Y, z);

  // ── Body material ──
  const bodyMat = new StandardMaterial('agent-body-mat', scene);
  bodyMat.diffuseColor = AVATAR_COLOR;
  bodyMat.specularColor = new Color3(0.3, 0.3, 0.3);
  bodyMat.emissiveColor = AVATAR_COLOR.scale(0.15);

  // ── Body (capsule approximation: cylinder + sphere top/bottom) ──
  const body = MeshBuilder.CreateCylinder(
    'agent-body',
    {
      height: BODY_HEIGHT,
      diameterTop: BODY_RADIUS * 2,
      diameterBottom: BODY_RADIUS * 2,
      tessellation: 16,
    },
    scene,
  );
  body.material = bodyMat;
  body.parent = root;
  body.position.y = BODY_HEIGHT / 2;

  // ── Head ──
  const headMat = new StandardMaterial('agent-head-mat', scene);
  headMat.diffuseColor = AVATAR_COLOR.scale(1.1);
  headMat.specularColor = new Color3(0.4, 0.4, 0.4);
  headMat.emissiveColor = AVATAR_COLOR.scale(0.2);

  const head = MeshBuilder.CreateSphere(
    'agent-head',
    { diameter: HEAD_RADIUS * 2, segments: 12 },
    scene,
  );
  head.material = headMat;
  head.parent = root;
  head.position.y = BODY_HEIGHT + HEAD_RADIUS * 0.8;

  // ── Status indicator (floating sphere above head) ──
  const indicatorMat = new StandardMaterial('agent-indicator-mat', scene);
  indicatorMat.diffuseColor = STATUS_COLORS.idle;
  indicatorMat.emissiveColor = STATUS_COLORS.idle.scale(0.5);

  const indicator = MeshBuilder.CreateSphere(
    'agent-indicator',
    { diameter: INDICATOR_RADIUS * 2, segments: 8 },
    scene,
  );
  indicator.material = indicatorMat;
  indicator.parent = root;
  indicator.position.y = BODY_HEIGHT + HEAD_RADIUS * 2 + INDICATOR_Y_OFFSET;

  avatar = {
    root,
    body,
    head,
    indicator,
    status: 'idle',
    isMoving: false,
  };

  // Start idle bobbing animation
  startIdleAnimation(scene);

  return avatar;
}

/**
 * Get the current avatar instance.
 */
export function getAgentAvatar(): AgentAvatar | null {
  return avatar;
}

/**
 * Set the avatar's status and update the indicator color.
 */
export function setAvatarStatus(status: AgentStatus, scene: Scene): void {
  if (!avatar) return;
  avatar.status = status;

  const mat = avatar.indicator.material as StandardMaterial;
  const color = STATUS_COLORS[status];
  mat.diffuseColor = color;
  mat.emissiveColor = color.scale(0.5);

  // Pulse the indicator on status change
  pulseIndicator(scene);
}

/**
 * Move the avatar to a target position with smooth animation.
 * Returns a promise that resolves when the movement is complete.
 */
export function moveAvatarTo(
  x: number,
  z: number,
  durationMs: number,
  scene: Scene,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!avatar) {
      resolve();
      return;
    }

    if (durationMs <= 0) {
      avatar.root.position.x = x;
      avatar.root.position.z = z;
      resolve();
      return;
    }

    avatar.isMoving = true;

    const fps = 60;
    const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));

    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

    // X animation
    const xAnim = new Animation(
      'avatarMoveX',
      'position.x',
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    xAnim.setKeys([
      { frame: 0, value: avatar.root.position.x },
      { frame: totalFrames, value: x },
    ]);
    xAnim.setEasingFunction(ease);

    // Z animation
    const zAnim = new Animation(
      'avatarMoveZ',
      'position.z',
      fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    zAnim.setKeys([
      { frame: 0, value: avatar.root.position.z },
      { frame: totalFrames, value: z },
    ]);
    zAnim.setEasingFunction(ease);

    scene.beginDirectAnimation(
      avatar.root,
      [xAnim, zAnim],
      0,
      totalFrames,
      false,
      1.0,
      () => {
        if (avatar) avatar.isMoving = false;
        resolve();
      },
    );
  });
}

/**
 * Get the avatar's current world position.
 */
export function getAvatarPosition(): { x: number; z: number } | null {
  if (!avatar) return null;
  return {
    x: avatar.root.position.x,
    z: avatar.root.position.z,
  };
}

/**
 * Set avatar position immediately (no animation).
 */
export function setAvatarPosition(x: number, z: number): void {
  if (!avatar) return;
  avatar.root.position.x = x;
  avatar.root.position.z = z;
}

/**
 * Start a gentle idle bobbing animation on the indicator.
 */
function startIdleAnimation(scene: Scene): void {
  if (!avatar) return;

  const idleAnim = new Animation(
    'indicatorBob',
    'position.y',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );

  const baseY = BODY_HEIGHT + HEAD_RADIUS * 2 + INDICATOR_Y_OFFSET;
  idleAnim.setKeys([
    { frame: 0, value: baseY },
    { frame: 30, value: baseY + 0.15 },
    { frame: 60, value: baseY },
  ]);

  scene.beginDirectAnimation(avatar.indicator, [idleAnim], 0, 60, true, 0.5);
}

/**
 * Pulse the indicator briefly on status change.
 */
function pulseIndicator(scene: Scene): void {
  if (!avatar) return;

  const scaleAnim = new Animation(
    'indicatorPulse',
    'scaling.x',
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  scaleAnim.setKeys([
    { frame: 0, value: 1 },
    { frame: 8, value: 1.8 },
    { frame: 20, value: 1 },
  ]);

  const scaleY = scaleAnim.clone();
  scaleY.targetProperty = 'scaling.y';
  const scaleZ = scaleAnim.clone();
  scaleZ.targetProperty = 'scaling.z';

  scene.beginDirectAnimation(avatar.indicator, [scaleAnim, scaleY, scaleZ], 0, 20, false);
}

/**
 * Dispose the avatar from the scene.
 */
export function disposeAgentAvatar(): void {
  if (!avatar) return;
  avatar.indicator.dispose();
  avatar.head.dispose();
  avatar.body.dispose();
  avatar.root.dispose();
  avatar = null;
}

/**
 * Play a simple animation on the avatar body (visual feedback for actions).
 * Animations:
 * - walk: gentle sway
 * - pickUp: body tilts forward
 * - carry: body rises slightly
 * - place: body tilts forward and settles
 * - searchScan: indicator spins rapidly
 * - think: head nods
 */
export function playAvatarAnimation(
  type: string,
  durationMs: number,
  scene: Scene,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!avatar || durationMs <= 0) {
      resolve();
      return;
    }

    const fps = 60;
    const frames = Math.max(1, Math.round((durationMs / 1000) * fps));

    switch (type) {
      case 'pickUp':
      case 'place': {
        // Body tilts forward
        const tiltAnim = new Animation(
          'bodyTilt',
          'rotation.x',
          fps,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
        );
        tiltAnim.setKeys([
          { frame: 0, value: 0 },
          { frame: Math.round(frames * 0.4), value: 0.3 },
          { frame: frames, value: 0 },
        ]);
        scene.beginDirectAnimation(avatar.body, [tiltAnim], 0, frames, false, 1, resolve);
        break;
      }
      case 'carry': {
        // Body rises
        const riseAnim = new Animation(
          'bodyRise',
          'position.y',
          fps,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
        );
        const baseY = avatar.root.position.y;
        riseAnim.setKeys([
          { frame: 0, value: baseY },
          { frame: Math.round(frames * 0.5), value: baseY + 0.3 },
          { frame: frames, value: baseY },
        ]);
        scene.beginDirectAnimation(avatar.root, [riseAnim], 0, frames, false, 1, resolve);
        break;
      }
      case 'searchScan': {
        // Indicator spins
        const spinAnim = new Animation(
          'indicatorSpin',
          'rotation.y',
          fps,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
        );
        spinAnim.setKeys([
          { frame: 0, value: 0 },
          { frame: frames, value: Math.PI * 4 },
        ]);
        scene.beginDirectAnimation(avatar.indicator, [spinAnim], 0, frames, false, 1, resolve);
        break;
      }
      case 'think': {
        // Head nods
        const nodAnim = new Animation(
          'headNod',
          'rotation.x',
          fps,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
        );
        nodAnim.setKeys([
          { frame: 0, value: 0 },
          { frame: Math.round(frames * 0.25), value: 0.2 },
          { frame: Math.round(frames * 0.5), value: 0 },
          { frame: Math.round(frames * 0.75), value: 0.2 },
          { frame: frames, value: 0 },
        ]);
        scene.beginDirectAnimation(avatar.head, [nodAnim], 0, frames, false, 1, resolve);
        break;
      }
      default:
        // Walk / idle — resolve immediately
        resolve();
        break;
    }
  });
}
