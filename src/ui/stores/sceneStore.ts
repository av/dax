import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AnyDataObject, Vector3, Boundary, BoundaryInstruction } from '@/types';

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(point: Vector3, vertices: Vector3[]): boolean {
  if (vertices.length < 3) return false;

  let inside = false;
  const x = point.x;
  const z = point.z;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    if (!vi || !vj) continue;

    const xi = vi.x;
    const zi = vi.z;
    const xj = vj.x;
    const zj = vj.z;

    if (((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

export interface SceneState {
  objects: Map<string, AnyDataObject>;
  selectedIds: Set<string>;
  hoveredId: string | null;
  isLoading: boolean;
  error: string | null;

  // Object CRUD
  addObject: (object: AnyDataObject) => void;
  updateObject: (id: string, changes: Partial<AnyDataObject>) => void;
  removeObject: (id: string) => void;
  getObject: (id: string) => AnyDataObject | undefined;

  // Selection
  select: (ids: string[], additive?: boolean) => void;
  deselect: (ids: string[]) => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;

  setHovered: (id: string | null) => void;

  updateObjectPosition: (id: string, position: Vector3, velocity?: Vector3) => void;

  // Boundary-specific operations
  getBoundaries: () => Boundary[];
  getBoundary: (id: string) => Boundary | undefined;
  updateBoundaryInstructions: (boundaryId: string, instructions: BoundaryInstruction[]) => void;
  addBoundaryInstruction: (boundaryId: string, instruction: BoundaryInstruction) => void;
  removeBoundaryInstruction: (boundaryId: string, instructionId: string) => void;
  updateBoundaryInstruction: (boundaryId: string, instructionId: string, changes: Partial<BoundaryInstruction>) => void;
  getObjectsInBoundary: (boundaryId: string) => AnyDataObject[];

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useSceneStore = create<SceneState>()(
  subscribeWithSelector((set, get) => ({
    objects: new Map(),
    selectedIds: new Set(),
    hoveredId: null,
    isLoading: false,
    error: null,

    addObject: (object) => {
      set((state) => {
        const newObjects = new Map(state.objects);
        newObjects.set(object.id, object);
        return { objects: newObjects };
      });
    },

    updateObject: (id, changes) => {
      set((state) => {
        const existing = state.objects.get(id);
        if (!existing) return state;

        const newObjects = new Map(state.objects);
        newObjects.set(id, {
          ...existing,
          ...changes,
          updatedAt: Date.now(),
        } as AnyDataObject);
        return { objects: newObjects };
      });
    },

    removeObject: (id) => {
      set((state) => {
        const newObjects = new Map(state.objects);
        newObjects.delete(id);

        const newSelectedIds = new Set(state.selectedIds);
        newSelectedIds.delete(id);

        return {
          objects: newObjects,
          selectedIds: newSelectedIds,
          hoveredId: state.hoveredId === id ? null : state.hoveredId,
        };
      });
    },

    getObject: (id) => get().objects.get(id),

    select: (ids, additive = false) => {
      set((state) => {
        const newSelectedIds = additive ? new Set(state.selectedIds) : new Set<string>();
        ids.forEach((id) => {
          if (state.objects.has(id)) {
            newSelectedIds.add(id);
          }
        });

        const newObjects = new Map(state.objects);
        newObjects.forEach((obj, objId) => {
          const shouldBeSelected = newSelectedIds.has(objId);
          if (obj.isSelected !== shouldBeSelected) {
            newObjects.set(objId, { ...obj, isSelected: shouldBeSelected } as AnyDataObject);
          }
        });

        return { objects: newObjects, selectedIds: newSelectedIds };
      });
    },

    deselect: (ids) => {
      set((state) => {
        const newSelectedIds = new Set(state.selectedIds);
        const newObjects = new Map(state.objects);

        ids.forEach((id) => {
          newSelectedIds.delete(id);
          const obj = newObjects.get(id);
          if (obj && obj.isSelected) {
            newObjects.set(id, { ...obj, isSelected: false } as AnyDataObject);
          }
        });

        return { objects: newObjects, selectedIds: newSelectedIds };
      });
    },

    clearSelection: () => {
      set((state) => {
        if (state.selectedIds.size === 0) return state;

        const newObjects = new Map(state.objects);
        state.selectedIds.forEach((id) => {
          const obj = newObjects.get(id);
          if (obj) {
            newObjects.set(id, { ...obj, isSelected: false } as AnyDataObject);
          }
        });

        return { objects: newObjects, selectedIds: new Set() };
      });
    },

    toggleSelection: (id) => {
      set((state) => {
        const newSelectedIds = new Set(state.selectedIds);
        const newObjects = new Map(state.objects);
        const obj = newObjects.get(id);

        if (!obj) return state;

        if (newSelectedIds.has(id)) {
          newSelectedIds.delete(id);
          newObjects.set(id, { ...obj, isSelected: false } as AnyDataObject);
        } else {
          newSelectedIds.add(id);
          newObjects.set(id, { ...obj, isSelected: true } as AnyDataObject);
        }

        return { objects: newObjects, selectedIds: newSelectedIds };
      });
    },

    setHovered: (id) => set({ hoveredId: id }),

    updateObjectPosition: (id, position, velocity) => {
      set((state) => {
        const obj = state.objects.get(id);
        if (!obj) return state;

        const newObjects = new Map(state.objects);
        newObjects.set(id, {
          ...obj,
          position,
          velocity: velocity ?? obj.velocity,
          updatedAt: Date.now(),
        } as AnyDataObject);

        return { objects: newObjects };
      });
    },

    getBoundaries: () => {
      const objects = Array.from(get().objects.values());
      return objects.filter((obj): obj is Boundary => obj.type === 'boundary');
    },

    getBoundary: (id) => {
      const obj = get().objects.get(id);
      return obj?.type === 'boundary' ? (obj as Boundary) : undefined;
    },

    updateBoundaryInstructions: (boundaryId, instructions) => {
      set((state) => {
        const boundary = state.objects.get(boundaryId);
        if (!boundary || boundary.type !== 'boundary') return state;

        const newObjects = new Map(state.objects);
        newObjects.set(boundaryId, {
          ...boundary,
          instructions,
          updatedAt: Date.now(),
        } as Boundary);

        return { objects: newObjects };
      });
    },

    addBoundaryInstruction: (boundaryId, instruction) => {
      set((state) => {
        const boundary = state.objects.get(boundaryId);
        if (!boundary || boundary.type !== 'boundary') return state;

        const b = boundary as Boundary;
        const newObjects = new Map(state.objects);
        newObjects.set(boundaryId, {
          ...b,
          instructions: [...b.instructions, instruction],
          updatedAt: Date.now(),
        } as Boundary);

        return { objects: newObjects };
      });
    },

    removeBoundaryInstruction: (boundaryId, instructionId) => {
      set((state) => {
        const boundary = state.objects.get(boundaryId);
        if (!boundary || boundary.type !== 'boundary') return state;

        const b = boundary as Boundary;
        const newObjects = new Map(state.objects);
        newObjects.set(boundaryId, {
          ...b,
          instructions: b.instructions.filter((i) => i.id !== instructionId),
          updatedAt: Date.now(),
        } as Boundary);

        return { objects: newObjects };
      });
    },

    updateBoundaryInstruction: (boundaryId, instructionId, changes) => {
      set((state) => {
        const boundary = state.objects.get(boundaryId);
        if (!boundary || boundary.type !== 'boundary') return state;

        const b = boundary as Boundary;
        const newInstructions = b.instructions.map((i) =>
          i.id === instructionId ? { ...i, ...changes } : i
        );

        const newObjects = new Map(state.objects);
        newObjects.set(boundaryId, {
          ...b,
          instructions: newInstructions,
          updatedAt: Date.now(),
        } as Boundary);

        return { objects: newObjects };
      });
    },

    getObjectsInBoundary: (boundaryId) => {
      const state = get();
      const boundary = state.objects.get(boundaryId);
      if (!boundary || boundary.type !== 'boundary') return [];

      const b = boundary as Boundary;
      const vertices = b.vertices;
      if (vertices.length < 3) return [];

      // Get all non-boundary objects
      const objects = Array.from(state.objects.values()).filter(
        (obj) => obj.type !== 'boundary' && obj.type !== 'beacon'
      );

      // Check which objects are inside the boundary using point-in-polygon
      return objects.filter((obj) => {
        const point = obj.position;
        return isPointInPolygon(point, vertices);
      });
    },

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    clear: () =>
      set({
        objects: new Map(),
        selectedIds: new Set(),
        hoveredId: null,
        error: null,
      }),
  }))
);
