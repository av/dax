/**
 * Camera signal.
 * Tracks the camera state (position, target, zoom) for the 3D scene.
 */
import { createSignal } from 'solid-js';
import {
  CAMERA_DEFAULT_ALPHA,
  CAMERA_DEFAULT_BETA,
  CAMERA_DEFAULT_RADIUS,
} from '@shared/constants';

export interface CameraState {
  /** Horizontal angle (radians) */
  alpha: number;
  /** Vertical angle (radians) */
  beta: number;
  /** Distance from target */
  radius: number;
  /** Look-at target X */
  targetX: number;
  /** Look-at target Y */
  targetY: number;
  /** Look-at target Z */
  targetZ: number;
}

const defaultCamera: CameraState = {
  alpha: CAMERA_DEFAULT_ALPHA,
  beta: CAMERA_DEFAULT_BETA,
  radius: CAMERA_DEFAULT_RADIUS,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
};

const [cameraState, setCameraState] = createSignal<CameraState>(defaultCamera);

export { cameraState, setCameraState };

/** Reset camera to defaults. */
export function resetCamera(): void {
  setCameraState(defaultCamera);
}
