import * as THREE from 'three';
import type { Scene } from './Scene';
import type { Physics } from './Physics';
import { sceneEvents } from './events';
import type { AnyDataObject, FileObject as FileObjectType, Snippet as SnippetType, Vector3 } from '@/types';
import { DataObject3D } from '@/objects/DataObject';
import { FileObject3D } from '@/objects/FileObject';
import { Snippet3D } from '@/objects/Snippet';
import { AgentAvatar } from '@/objects/AgentAvatar';
import { getFileMetadata } from '@/services/tauri';
import { v4 as uuidv4 } from 'uuid';
import { createVector3 } from '@/types';

export interface ObjectManagerConfig {
  defaultSpawnHeight: number;
  physicsEnabled: boolean;
}

const DEFAULT_CONFIG: ObjectManagerConfig = {
  defaultSpawnHeight: 5,
  physicsEnabled: true,
};

/**
 * File modification from sandbox execution
 */
export interface SandboxFileModification {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  timestamp: number;
}

/**
 * Manages the lifecycle of all data objects in the scene
 */
export class ObjectManager {
  private scene: Scene;
  private physics: Physics | null;
  private config: ObjectManagerConfig;
  
  private objects: Map<string, DataObject3D> = new Map();
  private objectData: Map<string, AnyDataObject> = new Map();

  constructor(scene: Scene, physics: Physics | null, config: Partial<ObjectManagerConfig> = {}) {
    this.scene = scene;
    this.physics = physics;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a file object from a file path
   */
  public async createFileObject(
    filePath: string,
    position: Vector3 = createVector3(0, this.config.defaultSpawnHeight, 0)
  ): Promise<FileObject3D | null> {
    try {
      // Get file metadata from Tauri backend
      const metadata = await getFileMetadata(filePath);
      
      // Create file object data
      const id = uuidv4();
      const fileData: FileObjectType = {
        id,
        type: 'file',
        position,
        rotation: createVector3(),
        scale: createVector3(1, 1, 1),
        velocity: createVector3(),
        isStatic: false,
        isSelected: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
        path: metadata.path,
        name: metadata.name,
        extension: metadata.extension,
        category: metadata.category as FileObjectType['category'],
        sizeBytes: metadata.sizeBytes,
        mimeType: metadata.mimeType,
        isEditable: metadata.isReadable && metadata.isWritable,
        lastModified: metadata.lastModified,
      };

      // Create 3D representation
      const object3D = new FileObject3D(fileData);
      
      // Add to scene
      this.scene.add(object3D);
      
      // Add physics body if enabled
      if (this.physics && this.config.physicsEnabled) {
        const size = { x: 1, y: 1, z: 0.3 }; // Base size for physics
        this.physics.createBody(id, position, size, false);
      }

      // Store references
      this.objects.set(id, object3D);
      this.objectData.set(id, fileData);

      // Emit creation event
      sceneEvents.emit('object:created', { object: fileData });

      return object3D;
    } catch (error) {
      console.error('Failed to create file object:', error);
      sceneEvents.emit('scene:error', {
        error: `Failed to import file: ${error}`,
        recoverable: true,
      });
      return null;
    }
  }

  /**
   * Create file objects from dropped files
   */
  public async createFromDroppedFiles(
    files: Array<{ path: string; name: string }>,
    dropPosition: Vector3
  ): Promise<FileObject3D[]> {
    const created: FileObject3D[] = [];
    
    // Spread files around drop position
    const spacing = 2;
    const cols = Math.ceil(Math.sqrt(files.length));
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      
      const col = i % cols;
      const row = Math.floor(i / cols);
      const offset = {
        x: (col - (cols - 1) / 2) * spacing,
        z: (row - (Math.ceil(files.length / cols) - 1) / 2) * spacing,
      };
      
      const position: Vector3 = {
        x: dropPosition.x + offset.x,
        y: this.config.defaultSpawnHeight,
        z: dropPosition.z + offset.z,
      };

      const object = await this.createFileObject(file.path, position);
      if (object) {
        created.push(object);
      }
    }

    return created;
  }

  /**
   * Create a snippet object at a position
   */
  public createSnippet(
    position: Vector3,
    data: { title?: string; content?: string; tags?: string[]; color?: string } = {}
  ): Snippet3D {
    const id = uuidv4();
    
    const snippetData: SnippetType = {
      id,
      type: 'snippet',
      position,
      rotation: createVector3(),
      scale: createVector3(1, 1, 1),
      velocity: createVector3(),
      isStatic: false,
      isSelected: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {},
      title: data.title || 'New Snippet',
      content: data.content || '',
      tags: data.tags || [],
      color: data.color || '#c9b1ff', // Default snippet color
    };

    // Create 3D representation
    const object3D = new Snippet3D(snippetData);
    
    // Add to scene
    this.scene.add(object3D);
    
    // Add physics body if enabled
    if (this.physics && this.config.physicsEnabled) {
      const size = { x: 0.8, y: 0.1, z: 0.8 };
      this.physics.createBody(id, position, size, false);
    }

    // Store references
    this.objects.set(id, object3D);
    this.objectData.set(id, snippetData);

    // Emit creation event
    sceneEvents.emit('object:created', { object: snippetData });

    return object3D;
  }

  /**
   * Get an object by ID
   */
  public getObject(id: string): DataObject3D | undefined {
    return this.objects.get(id);
  }

  /**
   * Get object data by ID
   */
  public getObjectData(id: string): AnyDataObject | undefined {
    return this.objectData.get(id);
  }

  /**
   * Get all objects
   */
  public getAllObjects(): DataObject3D[] {
    return Array.from(this.objects.values());
  }

  /**
   * Get all object data
   */
  public getAllObjectData(): AnyDataObject[] {
    return Array.from(this.objectData.values());
  }

  /**
   * Update object position from physics
   */
  public updateObjectPosition(id: string, position: Vector3, velocity: Vector3): void {
    const object = this.objects.get(id);
    const data = this.objectData.get(id);
    
    if (object && data) {
      object.position.set(position.x, position.y, position.z);
      data.position = position;
      data.velocity = velocity;
      data.updatedAt = Date.now();
    }
  }

  /**
   * Update object data
   */
  public updateObject(id: string, changes: Partial<AnyDataObject>): void {
    const object = this.objects.get(id);
    const data = this.objectData.get(id);
    
    if (object && data) {
      Object.assign(data, changes, { updatedAt: Date.now() });
      object.updateData(changes);
      
      sceneEvents.emit('object:updated', { id, changes });
    }
  }

  /**
   * Remove an object
   */
  public removeObject(id: string): void {
    const object = this.objects.get(id);
    
    if (object) {
      // Remove from scene
      this.scene.remove(object);
      
      // Remove physics body
      if (this.physics) {
        this.physics.removeBody(id);
      }
      
      // Cleanup
      object.dispose();
      
      // Remove from maps
      this.objects.delete(id);
      this.objectData.delete(id);
      
      // Emit deletion event
      sceneEvents.emit('object:deleted', { id });
    }
  }

  /**
   * Select objects by ID
   */
  public selectObjects(ids: string[], additive: boolean = false): void {
    if (!additive) {
      // Deselect all first
      this.objects.forEach((obj) => obj.setSelected(false));
    }
    
    ids.forEach((id) => {
      const object = this.objects.get(id);
      if (object) {
        object.setSelected(true);
      }
    });
  }

  /**
   * Get selected object IDs
   */
  public getSelectedIds(): string[] {
    return Array.from(this.objects.entries())
      .filter(([_, obj]) => obj.isSelected)
      .map(([id]) => id);
  }

  /**
   * Clear selection
   */
  public clearSelection(): void {
    this.objects.forEach((obj) => obj.setSelected(false));
  }

  /**
   * Set hover state for an object
   */
  public setHovered(id: string | null): void {
    this.objects.forEach((obj, objId) => {
      obj.setHovered(objId === id);
    });
  }

  /**
   * Get objects at raycast intersection
   */
  public raycastObjects(raycaster: THREE.Raycaster): Array<{ id: string; point: THREE.Vector3; distance: number }> {
    const results: Array<{ id: string; point: THREE.Vector3; distance: number }> = [];
    
    this.objects.forEach((object, id) => {
      const meshes = object.getRaycastMeshes();
      const intersects = raycaster.intersectObjects(meshes, false);
      
      if (intersects.length > 0 && intersects[0]) {
        results.push({
          id,
          point: intersects[0].point,
          distance: intersects[0].distance,
        });
      }
    });
    
    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);
    
    return results;
  }

  /**
   * Move selected objects by delta
   */
  public moveSelectedObjects(delta: Vector3): void {
    const selectedIds = this.getSelectedIds();
    
    selectedIds.forEach((id) => {
      const object = this.objects.get(id);
      if (object) {
        const newPos: Vector3 = {
          x: object.position.x + delta.x,
          y: object.position.y + delta.y,
          z: object.position.z + delta.z,
        };
        
        object.setWorldPosition(newPos);
        
        // Update physics body position
        if (this.physics) {
          this.physics.setBodyPosition(id, newPos);
        }
      }
    });
  }

  /**
   * Release dragged objects (apply physics)
   */
  public releaseDraggedObjects(): void {
    const selectedIds = this.getSelectedIds();
    
    selectedIds.forEach((id) => {
      if (this.physics) {
        // Wake up the physics body
        this.physics.wakeBody(id);
        // Apply small downward impulse to ensure settling
        this.physics.applyImpulse(id, { x: 0, y: -0.5, z: 0 });
      }
    });
  }

  /**
   * Add an agent avatar to the scene
   */
  public addAgentAvatar(avatar: AgentAvatar): void {
    this.scene.add(avatar);
  }

  /**
   * Remove an agent avatar from the scene
   */
  public removeAgentAvatar(avatar: AgentAvatar): void {
    this.scene.remove(avatar);
    avatar.dispose();
  }

  /**
   * Set the "being analyzed" state on an object
   */
  public setObjectAnalyzing(id: string, isBeingAnalyzed: boolean): void {
    const object = this.objects.get(id);
    if (object && object instanceof FileObject3D) {
      object.setAnalyzingState(isBeingAnalyzed);
    }
  }

  /**
   * Clear all objects
   */
  public clear(): void {
    this.objects.forEach((object, id) => {
      this.scene.remove(object);
      object.dispose();
      if (this.physics) {
        this.physics.removeBody(id);
      }
    });
    
    this.objects.clear();
    this.objectData.clear();
  }

  /**
   * Sync file modifications from sandbox execution to plane objects
   * Handles created, modified, and deleted files
   */
  public async syncSandboxFileModifications(
    modifications: SandboxFileModification[]
  ): Promise<void> {
    for (const mod of modifications) {
      switch (mod.action) {
        case 'created':
          // Check if file already exists on plane
          const existing = this.findObjectByPath(mod.path);
          if (!existing) {
            // Create new file object at a default position
            const position = createVector3(
              Math.random() * 10 - 5,
              this.config.defaultSpawnHeight,
              Math.random() * 10 - 5
            );
            await this.createFileObject(mod.path, position);
          }
          break;

        case 'modified':
          // Refresh file metadata for existing object
          await this.refreshFileObject(mod.path);
          break;

        case 'deleted':
          // Remove object from plane if it exists
          const toDelete = this.findObjectByPath(mod.path);
          if (toDelete) {
            this.removeObject(toDelete);
          }
          break;
      }
    }

    // Emit sync complete event
    sceneEvents.emit('sandbox:sync', {
      modifications: modifications.length,
    });
  }

  /**
   * Find object ID by file path
   */
  private findObjectByPath(filePath: string): string | undefined {
    for (const [id, data] of this.objectData.entries()) {
      if (data.type === 'file' && (data as FileObjectType).path === filePath) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Refresh file object metadata
   */
  public async refreshFileObject(filePath: string): Promise<void> {
    const id = this.findObjectByPath(filePath);
    if (!id) return;

    try {
      const metadata = await getFileMetadata(filePath);
      const data = this.objectData.get(id) as FileObjectType;
      
      if (data) {
        // Update metadata
        data.sizeBytes = metadata.sizeBytes;
        data.lastModified = metadata.lastModified;
        data.updatedAt = Date.now();
        
        // Emit update event
        sceneEvents.emit('object:updated', {
          id,
          changes: {
            sizeBytes: metadata.sizeBytes,
            lastModified: metadata.lastModified,
          },
        });
      }
    } catch (error) {
      console.error('Failed to refresh file object:', error);
    }
  }

  /**
   * Find nearby file objects for link suggestions
   * Returns file objects within a certain distance of the given position
   */
  public findNearbyFileObjects(
    position: Vector3,
    maxDistance: number = 3.0
  ): Array<{ id: string; data: FileObjectType; distance: number }> {
    const nearby: Array<{ id: string; data: FileObjectType; distance: number }> = [];

    for (const [id, data] of this.objectData.entries()) {
      if (data.type !== 'file') continue;

      const dx = data.position.x - position.x;
      const dy = data.position.y - position.y;
      const dz = data.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance <= maxDistance) {
        nearby.push({
          id,
          data: data as FileObjectType,
          distance,
        });
      }
    }

    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);

    return nearby;
  }

  /**
   * Link a snippet to a file object
   */
  public linkSnippetToFile(snippetId: string, fileId: string): boolean {
    const snippetObj = this.objects.get(snippetId);
    const fileData = this.objectData.get(fileId);

    if (!snippetObj || !fileData || !(snippetObj instanceof Snippet3D)) {
      return false;
    }

    // Update snippet link visual
    snippetObj.linkTo(fileId, fileData.position);

    // Update snippet data
    const snippetData = this.objectData.get(snippetId) as SnippetType;
    if (snippetData) {
      snippetData.sourceFileId = fileId;
      snippetData.updatedAt = Date.now();

      sceneEvents.emit('object:updated', {
        id: snippetId,
        changes: { sourceFileId: fileId },
      });
    }

    return true;
  }

  /**
   * Unlink a snippet from its source file
   */
  public unlinkSnippet(snippetId: string): boolean {
    const snippetObj = this.objects.get(snippetId);

    if (!snippetObj || !(snippetObj instanceof Snippet3D)) {
      return false;
    }

    snippetObj.unlink();

    // Update snippet data
    const snippetData = this.objectData.get(snippetId) as SnippetType;
    if (snippetData) {
      snippetData.sourceFileId = undefined;
      snippetData.sourceRange = undefined;
      snippetData.updatedAt = Date.now();

      sceneEvents.emit('object:updated', {
        id: snippetId,
        changes: { sourceFileId: undefined, sourceRange: undefined },
      });
    }

    return true;
  }

  /**
   * Update snippet link visuals when objects move
   */
  public updateSnippetLinks(): void {
    for (const [, obj] of this.objects.entries()) {
      if (!(obj instanceof Snippet3D)) continue;

      const linkedId = obj.getLinkedObjectId();
      if (!linkedId) continue;

      const linkedData = this.objectData.get(linkedId);
      if (linkedData) {
        obj.updateLinkVisual(linkedData.position);
      }
    }
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.clear();
  }
}
