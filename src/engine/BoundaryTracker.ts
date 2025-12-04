import { sceneEvents } from './events';
import type { Boundary, Vector3, AnyDataObject } from '@/types';

/**
 * Tracks objects entering and exiting boundaries
 */
export class BoundaryTracker {
  // Map of boundary ID -> Set of object IDs currently inside
  private objectsInBoundary: Map<string, Set<string>> = new Map();
  private boundaries: Map<string, Boundary> = new Map();

  /**
   * Update the list of tracked boundaries
   */
  public updateBoundaries(boundaries: Boundary[]): void {
    // Clear old boundaries that no longer exist
    const newBoundaryIds = new Set(boundaries.map((b) => b.id));
    for (const id of this.boundaries.keys()) {
      if (!newBoundaryIds.has(id)) {
        this.boundaries.delete(id);
        this.objectsInBoundary.delete(id);
      }
    }

    // Update boundaries
    for (const boundary of boundaries) {
      this.boundaries.set(boundary.id, boundary);
      if (!this.objectsInBoundary.has(boundary.id)) {
        this.objectsInBoundary.set(boundary.id, new Set());
      }
    }
  }

  /**
   * Check all objects against all boundaries and emit enter/exit events
   */
  public checkObjects(objects: AnyDataObject[]): void {
    // Skip boundaries and beacons themselves
    const trackableObjects = objects.filter(
      (obj) => obj.type !== 'boundary' && obj.type !== 'beacon'
    );

    for (const [boundaryId, boundary] of this.boundaries) {
      const currentlyInside = this.objectsInBoundary.get(boundaryId) ?? new Set();
      const newlyInside = new Set<string>();

      // Check each object
      for (const obj of trackableObjects) {
        if (this.isPointInBoundary(obj.position, boundary)) {
          newlyInside.add(obj.id);
        }
      }

      // Find objects that entered
      const entered: string[] = [];
      for (const id of newlyInside) {
        if (!currentlyInside.has(id)) {
          entered.push(id);
        }
      }

      // Find objects that exited
      const exited: string[] = [];
      for (const id of currentlyInside) {
        if (!newlyInside.has(id)) {
          exited.push(id);
        }
      }

      // Emit events
      if (entered.length > 0) {
        sceneEvents.emit('boundary:entered', {
          boundaryId,
          objectIds: entered,
        });
      }

      if (exited.length > 0) {
        sceneEvents.emit('boundary:exited', {
          boundaryId,
          objectIds: exited,
        });
      }

      // Update tracking
      this.objectsInBoundary.set(boundaryId, newlyInside);
    }
  }

  /**
   * Check if a point is inside a boundary using ray casting algorithm
   */
  private isPointInBoundary(point: Vector3, boundary: Boundary): boolean {
    const vertices = boundary.vertices;
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

  /**
   * Get all objects currently inside a boundary
   */
  public getObjectsInBoundary(boundaryId: string): string[] {
    return Array.from(this.objectsInBoundary.get(boundaryId) ?? []);
  }

  /**
   * Get all boundaries containing a specific object
   */
  public getBoundariesContainingObject(objectId: string): string[] {
    const boundaryIds: string[] = [];
    for (const [boundaryId, objectIds] of this.objectsInBoundary) {
      if (objectIds.has(objectId)) {
        boundaryIds.push(boundaryId);
      }
    }
    return boundaryIds;
  }

  /**
   * Clear all tracking state
   */
  public clear(): void {
    this.objectsInBoundary.clear();
    this.boundaries.clear();
  }
}
