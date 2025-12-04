/**
 * Persistence Service
 * Connects frontend stores to Tauri workspace commands for save/load operations
 */

import { invoke } from '@tauri-apps/api/core';
import { useSceneStore } from '../ui/stores/sceneStore';
import { useWorkspaceStore } from '../ui/stores/workspaceStore';
import { useAgentStore } from '../ui/stores/agentStore';
import type { AnyDataObject, Boundary, Beacon, Snippet, Workspace, CameraState as AppCameraState, WorkspaceSettings as AppWorkspaceSettings } from '../types';
import type { ChatMessage } from '../types/agent';
import { createDefaultCameraState, createDefaultWorkspaceSettings } from '../types';

// Types for backend workspace persistence (Tauri commands)
export interface WorkspaceMetadata {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
  version: string;
  tags: string[];
}

export interface BackendCameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom: number;
}

export interface BackendWorkspaceSettings {
  physics_enabled: boolean;
  gravity: number;
  grid_visible: boolean;
  grid_size: number;
  snap_to_grid: boolean;
  auto_save: boolean;
  auto_save_interval: number;
}

export interface ExportedWorkspace {
  metadata: WorkspaceMetadata;
  objects: AnyDataObject[];
  boundaries: Boundary[];
  beacons: Beacon[];
  snippets: Snippet[];
  camera_state: BackendCameraState;
  chat_history: ChatMessage[];
  settings: BackendWorkspaceSettings;
}

export interface CreateWorkspaceOptions {
  name: string;
  description?: string;
  path?: string;
  settings?: Partial<BackendWorkspaceSettings>;
}

export interface SaveWorkspaceRequest {
  objects: AnyDataObject[];
  boundaries: Boundary[];
  beacons: Beacon[];
  snippets: Snippet[];
  camera_state: BackendCameraState;
  settings: BackendWorkspaceSettings;
}

// Default settings for backend
const DEFAULT_BACKEND_SETTINGS: BackendWorkspaceSettings = {
  physics_enabled: true,
  gravity: -9.81,
  grid_visible: true,
  grid_size: 1,
  snap_to_grid: false,
  auto_save: true,
  auto_save_interval: 30000, // 30 seconds
};

// Persistence state
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
let isDirty = false;
let lastSaveTime = 0;

/**
 * Convert app settings to backend settings
 */
function toBackendSettings(settings: AppWorkspaceSettings): BackendWorkspaceSettings {
  return {
    physics_enabled: settings.physicsEnabled,
    gravity: -9.81,
    grid_visible: settings.gridVisible,
    grid_size: settings.gridSize,
    snap_to_grid: false,
    auto_save: settings.autoSaveEnabled,
    auto_save_interval: settings.autoSaveIntervalMs,
  };
}

/**
 * Convert backend settings to app settings
 */
function toAppSettings(settings: BackendWorkspaceSettings): AppWorkspaceSettings {
  return {
    physicsEnabled: settings.physics_enabled,
    gridVisible: settings.grid_visible,
    gridSize: settings.grid_size,
    autoSaveEnabled: settings.auto_save,
    autoSaveIntervalMs: settings.auto_save_interval,
  };
}

/**
 * Convert app camera state to backend camera state
 */
function toBackendCamera(camera: AppCameraState): BackendCameraState {
  return {
    position: camera.position,
    target: camera.target,
    zoom: camera.zoom,
  };
}

/**
 * Convert backend camera state to app camera state
 */
function toAppCamera(camera: BackendCameraState): AppCameraState {
  return {
    position: camera.position,
    target: camera.target,
    zoom: camera.zoom,
    rotation: { x: -Math.PI / 4, y: 0, z: 0 },
  };
}

/**
 * Create a new workspace
 */
export async function createWorkspace(options: CreateWorkspaceOptions): Promise<WorkspaceMetadata> {
  const result = await invoke<WorkspaceMetadata>('create_workspace', {
    request: {
      name: options.name,
      path: options.path || null,
    },
  });
  
  // Reset stores
  useSceneStore.getState().clear();
  
  // Create workspace object for the store
  const workspace: Workspace = {
    id: result.id,
    name: result.name,
    path: options.path || '',
    objectIds: [],
    camera: createDefaultCameraState(),
    settings: createDefaultWorkspaceSettings(),
    chatHistory: [],
    createdAt: result.created_at,
    updatedAt: result.updated_at,
    lastOpenedAt: Date.now(),
  };
  
  useWorkspaceStore.getState().setWorkspace(workspace);
  
  // Start auto-save
  startAutoSave();
  
  return result;
}

/**
 * Save current workspace state
 */
export async function saveWorkspace(): Promise<void> {
  const sceneState = useSceneStore.getState();
  const workspaceState = useWorkspaceStore.getState();
  
  if (!workspaceState.currentWorkspace) {
    throw new Error('No active workspace to save');
  }
  
  // Extract objects from Map
  const allObjects = Array.from(sceneState.objects.values());
  const boundaries = allObjects.filter((obj): obj is Boundary => obj.type === 'boundary');
  const beacons = allObjects.filter((obj): obj is Beacon => obj.type === 'beacon');
  const snippets = allObjects.filter((obj): obj is Snippet => obj.type === 'snippet');
  const dataObjects = allObjects.filter(obj => 
    obj.type !== 'boundary' && obj.type !== 'beacon' && obj.type !== 'snippet'
  );
  
  // Gather current state from stores
  const request: SaveWorkspaceRequest = {
    objects: dataObjects,
    boundaries,
    beacons,
    snippets,
    camera_state: toBackendCamera(workspaceState.currentWorkspace.camera),
    settings: toBackendSettings(workspaceState.currentWorkspace.settings),
  };
  
  await invoke('save_workspace', { request });
  
  workspaceState.markSaved();
  isDirty = false;
  lastSaveTime = Date.now();
  
  console.log('[Persistence] Workspace saved at', new Date().toISOString());
}

/**
 * Load a workspace from path
 */
export async function loadWorkspace(path: string): Promise<ExportedWorkspace> {
  const workspace = await invoke<ExportedWorkspace>('load_workspace', { path });
  
  // Restore state to stores
  restoreWorkspaceState(workspace, path);
  
  // Start auto-save
  startAutoSave();
  
  return workspace;
}

/**
 * Export workspace to a file
 */
export async function exportWorkspace(path: string): Promise<void> {
  await invoke('export_workspace', { path });
  console.log('[Persistence] Workspace exported to', path);
}

/**
 * Restore workspace state to stores
 */
function restoreWorkspaceState(exported: ExportedWorkspace, path: string): void {
  const sceneStore = useSceneStore.getState();
  const workspaceStore = useWorkspaceStore.getState();
  
  // Clear scene first
  sceneStore.clear();
  
  // Add all objects back
  exported.objects.forEach(obj => {
    sceneStore.addObject(obj);
  });
  
  // Restore boundaries
  exported.boundaries.forEach(boundary => {
    sceneStore.addObject(boundary);
  });
  
  // Restore beacons
  exported.beacons.forEach(beacon => {
    sceneStore.addObject(beacon);
  });
  
  // Restore snippets
  exported.snippets.forEach(snippet => {
    sceneStore.addObject(snippet);
  });
  
  // Create workspace object for the store
  const workspace: Workspace = {
    id: exported.metadata.id,
    name: exported.metadata.name,
    path: path,
    objectIds: [...exported.objects, ...exported.boundaries, ...exported.beacons, ...exported.snippets].map(o => o.id),
    camera: toAppCamera(exported.camera_state),
    settings: toAppSettings(exported.settings),
    chatHistory: exported.chat_history,
    createdAt: exported.metadata.created_at,
    updatedAt: exported.metadata.updated_at,
    lastOpenedAt: Date.now(),
  };
  
  workspaceStore.setWorkspace(workspace);
  
  // Restore camera state via event
  if (exported.camera_state) {
    window.dispatchEvent(new CustomEvent('restore-camera', { detail: toAppCamera(exported.camera_state) }));
  }
  
  isDirty = false;
  lastSaveTime = Date.now();
  
  console.log('[Persistence] Workspace restored:', exported.metadata.name);
}

/**
 * Mark workspace as dirty (needs save)
 */
export function markDirty(): void {
  isDirty = true;
  useWorkspaceStore.getState().markDirty();
}

/**
 * Check if workspace has unsaved changes
 */
export function hasUnsavedChanges(): boolean {
  return isDirty || useWorkspaceStore.getState().isDirty;
}

/**
 * Get time since last save
 */
export function timeSinceLastSave(): number {
  return lastSaveTime > 0 ? Date.now() - lastSaveTime : 0;
}

/**
 * Start auto-save timer
 */
export function startAutoSave(interval?: number): void {
  stopAutoSave();
  
  const saveInterval = interval || DEFAULT_BACKEND_SETTINGS.auto_save_interval;
  
  autoSaveTimer = setInterval(async () => {
    if (hasUnsavedChanges() && useWorkspaceStore.getState().currentWorkspace) {
      try {
        await saveWorkspace();
        console.log('[Persistence] Auto-saved workspace');
      } catch (error) {
        console.error('[Persistence] Auto-save failed:', error);
      }
    }
  }, saveInterval);
  
  console.log('[Persistence] Auto-save started with interval:', saveInterval, 'ms');
}

/**
 * Stop auto-save timer
 */
export function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
    console.log('[Persistence] Auto-save stopped');
  }
}

/**
 * Subscribe to store changes for dirty tracking
 */
export function subscribeToStoreChanges(): () => void {
  const unsubScene = useSceneStore.subscribe(() => {
    markDirty();
  });
  
  const unsubWorkspace = useWorkspaceStore.subscribe(() => {
    // Workspace store already tracks isDirty internally
  });
  
  const unsubAgent = useAgentStore.subscribe(() => {
    markDirty();
  });
  
  return () => {
    unsubScene();
    unsubWorkspace();
    unsubAgent();
  };
}

/**
 * Initialize persistence system
 */
export function initPersistence(): () => void {
  // Subscribe to store changes
  const unsubscribe = subscribeToStoreChanges();
  
  // Start auto-save
  startAutoSave();
  
  // Handle beforeunload to warn about unsaved changes
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  console.log('[Persistence] Initialized');
  
  // Return cleanup function
  return () => {
    unsubscribe();
    stopAutoSave();
    window.removeEventListener('beforeunload', handleBeforeUnload);
    console.log('[Persistence] Cleaned up');
  };
}

// Export persistence service as singleton
export const PersistenceService = {
  createWorkspace,
  saveWorkspace,
  loadWorkspace,
  exportWorkspace,
  markDirty,
  hasUnsavedChanges,
  timeSinceLastSave,
  startAutoSave,
  stopAutoSave,
  initPersistence,
};

export default PersistenceService;
