/**
 * Scene objects signal store.
 * Reactive store for 3D scene object positions and metadata.
 */
import { createStore } from 'solid-js/store';
import type { SceneObjectRow } from '../db/types';
export type { SceneObjectRow } from '../db/types';

export interface SceneObjectsState {
  /** Map of path → scene object for fast lookup */
  objects: Record<string, SceneObjectRow>;
  /** Whether scene objects are currently loading from DB */
  loading: boolean;
}

const [sceneObjects, setSceneObjects] = createStore<SceneObjectsState>({
  objects: {},
  loading: false,
});

export { sceneObjects, setSceneObjects };

/** Add or update a scene object. */
export function upsertSceneObject(obj: SceneObjectRow): void {
  setSceneObjects('objects', obj.path, obj);
}

/** Remove a scene object by path. */
export function removeSceneObject(path: string): void {
  setSceneObjects('objects', (prev) => {
    const next = { ...prev };
    delete next[path];
    return next;
  });
}

/** Replace all scene objects. */
export function replaceSceneObjects(objs: SceneObjectRow[]): void {
  const objectMap: Record<string, SceneObjectRow> = {};
  for (const obj of objs) {
    objectMap[obj.path] = obj;
  }
  setSceneObjects({ objects: objectMap, loading: false });
}

/** Get scene objects as array. */
export function getSceneObjectsList(): SceneObjectRow[] {
  return Object.values(sceneObjects.objects);
}
