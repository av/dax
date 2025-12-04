import type { Vector3 } from './objects';
import type { ChatMessage } from './agent';

export interface CameraState {
  position: Vector3;
  target: Vector3;
  zoom: number;
  rotation: Vector3;
}

export interface WorkspaceSettings {
  gridVisible: boolean;
  gridSize: number;
  physicsEnabled: boolean;
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  camera: CameraState;
  settings: WorkspaceSettings;
  objectIds: string[];
  chatHistory: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
}

export function createDefaultCameraState(): CameraState {
  return {
    position: { x: 0, y: 50, z: 50 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 1,
    rotation: { x: -Math.PI / 4, y: 0, z: 0 },
  };
}

export function createDefaultWorkspaceSettings(): WorkspaceSettings {
  return {
    gridVisible: true,
    gridSize: 100,
    physicsEnabled: true,
    autoSaveEnabled: true,
    autoSaveIntervalMs: 30000,
  };
}

export function createWorkspace(
  id: string,
  name: string,
  path: string
): Workspace {
  const now = Date.now();
  return {
    id,
    name,
    path,
    camera: createDefaultCameraState(),
    settings: createDefaultWorkspaceSettings(),
    objectIds: [],
    chatHistory: [],
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}
