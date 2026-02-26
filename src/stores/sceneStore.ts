import { create } from 'zustand';
import type { SceneSnapshot, SceneObjectSnapshot, SpatialRelationSnapshot } from '@/types';

// ── Types ────────────────────────────────────────────────

export interface SceneState {
  workspaceId: number | null;
  objects: Map<number, SceneObjectSnapshot>;
  relations: SpatialRelationSnapshot[];
  filePathToSceneObjectId: Map<string, number>;
  isLoaded: boolean;
  lastSavedAt: number | null;
  isDirty: boolean;
}

export interface SceneActions {
  loadSnapshot(snapshot: SceneSnapshot): void;
  markDirty(): void;
  markSaved(): void;
  reset(): void;
  getPositionOverridesFromSnapshot(): Map<string, [number, number, number]>;
}

// ── Initial State ────────────────────────────────────────

const initialState: SceneState = {
  workspaceId: null,
  objects: new Map(),
  relations: [],
  filePathToSceneObjectId: new Map(),
  isLoaded: false,
  lastSavedAt: null,
  isDirty: false,
};

// ── Store ────────────────────────────────────────────────

export const useSceneStore = create<SceneState & SceneActions>((set, get) => ({
  ...initialState,

  loadSnapshot(snapshot: SceneSnapshot): void {
    const objects = new Map<number, SceneObjectSnapshot>();
    const filePathToSceneObjectId = new Map<string, number>();

    for (const obj of snapshot.objects) {
      objects.set(obj.sceneObject.id, obj);
      if (obj.filePath !== null) {
        filePathToSceneObjectId.set(obj.filePath, obj.sceneObject.id);
      }
    }

    set({
      workspaceId: snapshot.workspaceId,
      objects,
      relations: snapshot.relations,
      filePathToSceneObjectId,
      isLoaded: true,
      isDirty: false,
    });
  },

  markDirty(): void {
    set({ isDirty: true });
  },

  markSaved(): void {
    set({ isDirty: false, lastSavedAt: Date.now() });
  },

  reset(): void {
    set({ ...initialState });
  },

  getPositionOverridesFromSnapshot(): Map<string, [number, number, number]> {
    const { objects } = get();
    const result = new Map<string, [number, number, number]>();

    for (const obj of objects.values()) {
      const { pos_x, pos_y, pos_z } = obj.sceneObject;
      if (obj.filePath !== null && pos_x !== null && pos_y !== null && pos_z !== null) {
        result.set(obj.filePath, [pos_x, pos_y, pos_z]);
      }
    }

    return result;
  },
}));
