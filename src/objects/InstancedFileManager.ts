import * as THREE from 'three';
import type { FileCategory, FileObject } from '@/types';
import { getFileTypeInfo, getFileSizeMultiplier, getGeometryType, type GeometryType } from '@/services/fileTypes';

/**
 * Configuration for the instanced file manager
 */
export interface InstancedFileManagerConfig {
  /** Maximum instances per category */
  maxInstancesPerCategory: number;
  /** Base size for objects */
  baseSize: number;
  /** Enable dynamic batching (reallocate when needed) */
  dynamicBatching: boolean;
}

const DEFAULT_CONFIG: InstancedFileManagerConfig = {
  maxInstancesPerCategory: 256,
  baseSize: 1,
  dynamicBatching: true,
};

/**
 * Per-instance data for tracking
 */
interface InstanceData {
  id: string;
  fileData: FileObject;
  instanceIndex: number;
  category: FileCategory;
  matrix: THREE.Matrix4;
  color: THREE.Color;
  isSelected: boolean;
  isHovered: boolean;
}

/**
 * Manages instanced meshes for file objects grouped by category
 * 
 * This provides significant performance improvements when rendering
 * many file objects by batching draw calls per category type.
 */
export class InstancedFileManager {
  private config: InstancedFileManagerConfig;
  private instancedMeshes: Map<FileCategory, THREE.InstancedMesh> = new Map();
  private instances: Map<string, InstanceData> = new Map();
  private categoryInstanceCounts: Map<FileCategory, number> = new Map();
  private parent: THREE.Object3D;
  
  // Temporary objects for reuse
  private tempMatrix = new THREE.Matrix4();
  private tempPosition = new THREE.Vector3();
  private tempQuaternion = new THREE.Quaternion();
  private tempScale = new THREE.Vector3();
  private tempColor = new THREE.Color();

  constructor(parent: THREE.Object3D, config: Partial<InstancedFileManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parent = parent;
    this.initializeCategories();
  }

  /**
   * Initialize instanced meshes for each file category
   */
  private initializeCategories(): void {
    const categories: FileCategory[] = [
      'text', 'code', 'image', 'document', 
      'data', 'archive', 'media', 'unknown'
    ];

    for (const category of categories) {
      this.createInstancedMesh(category);
      this.categoryInstanceCounts.set(category, 0);
    }
  }

  /**
   * Create an instanced mesh for a category
   */
  private createInstancedMesh(category: FileCategory): THREE.InstancedMesh {
    const geometryType = getGeometryType(category);
    const geometry = this.createGeometry(geometryType, this.config.baseSize);
    
    // Use a material that supports per-instance colors
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.2,
      flatShading: true,
    });

    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.config.maxInstancesPerCategory
    );
    
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.count = 0; // Start with no visible instances
    mesh.userData.category = category;
    mesh.userData.raycastable = true;
    
    this.instancedMeshes.set(category, mesh);
    this.parent.add(mesh);
    
    return mesh;
  }

  /**
   * Create geometry for a category type
   */
  private createGeometry(type: GeometryType, size: number): THREE.BufferGeometry {
    switch (type) {
      case 'box':
        return new THREE.BoxGeometry(size, size, size * 0.3);
      case 'cylinder':
        return new THREE.CylinderGeometry(size * 0.4, size * 0.4, size * 0.6, 8);
      case 'octahedron':
        return new THREE.OctahedronGeometry(size * 0.5);
      case 'sphere':
        return new THREE.SphereGeometry(size * 0.4, 16, 12);
      case 'dodecahedron':
        return new THREE.DodecahedronGeometry(size * 0.4);
      case 'tetrahedron':
        return new THREE.TetrahedronGeometry(size * 0.5);
      case 'icosahedron':
        return new THREE.IcosahedronGeometry(size * 0.4);
      default:
        return new THREE.BoxGeometry(size, size, size);
    }
  }

  /**
   * Add a file object as an instance
   */
  public addInstance(fileData: FileObject): boolean {
    if (this.instances.has(fileData.id)) {
      return false; // Already exists
    }

    const category = fileData.category;
    const mesh = this.instancedMeshes.get(category);
    if (!mesh) return false;

    const currentCount = this.categoryInstanceCounts.get(category) ?? 0;
    
    if (currentCount >= this.config.maxInstancesPerCategory) {
      if (this.config.dynamicBatching) {
        this.expandCategory(category);
      } else {
        console.warn(`Max instances reached for category ${category}`);
        return false;
      }
    }

    const instanceIndex = currentCount;
    const typeInfo = getFileTypeInfo(fileData.extension);
    const sizeMultiplier = getFileSizeMultiplier(fileData.sizeBytes);
    
    // Create instance data
    const instanceData: InstanceData = {
      id: fileData.id,
      fileData,
      instanceIndex,
      category,
      matrix: new THREE.Matrix4(),
      color: new THREE.Color(typeInfo.color),
      isSelected: false,
      isHovered: false,
    };

    // Calculate matrix
    this.tempPosition.set(
      fileData.position.x,
      fileData.position.y + (this.config.baseSize * sizeMultiplier) / 2,
      fileData.position.z
    );
    this.tempQuaternion.setFromEuler(
      new THREE.Euler(fileData.rotation.x, fileData.rotation.y, fileData.rotation.z)
    );
    this.tempScale.set(
      fileData.scale.x * sizeMultiplier,
      fileData.scale.y * sizeMultiplier,
      fileData.scale.z * sizeMultiplier
    );
    
    instanceData.matrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
    
    // Apply to mesh
    mesh.setMatrixAt(instanceIndex, instanceData.matrix);
    mesh.setColorAt(instanceIndex, instanceData.color);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    
    // Update counts
    mesh.count = instanceIndex + 1;
    this.categoryInstanceCounts.set(category, instanceIndex + 1);
    this.instances.set(fileData.id, instanceData);
    
    return true;
  }

  /**
   * Update an instance's transform
   */
  public updateInstance(id: string, updates: Partial<FileObject>): void {
    const instanceData = this.instances.get(id);
    if (!instanceData) return;

    const mesh = this.instancedMeshes.get(instanceData.category);
    if (!mesh) return;

    // Update fileData
    Object.assign(instanceData.fileData, updates);
    
    // Recalculate matrix if position/rotation/scale changed
    if (updates.position || updates.rotation || updates.scale) {
      const sizeMultiplier = getFileSizeMultiplier(instanceData.fileData.sizeBytes);
      
      this.tempPosition.set(
        instanceData.fileData.position.x,
        instanceData.fileData.position.y + (this.config.baseSize * sizeMultiplier) / 2,
        instanceData.fileData.position.z
      );
      this.tempQuaternion.setFromEuler(
        new THREE.Euler(
          instanceData.fileData.rotation.x,
          instanceData.fileData.rotation.y,
          instanceData.fileData.rotation.z
        )
      );
      this.tempScale.set(
        instanceData.fileData.scale.x * sizeMultiplier,
        instanceData.fileData.scale.y * sizeMultiplier,
        instanceData.fileData.scale.z * sizeMultiplier
      );
      
      instanceData.matrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      mesh.setMatrixAt(instanceData.instanceIndex, instanceData.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Set selection state for an instance
   */
  public setSelected(id: string, selected: boolean): void {
    const instanceData = this.instances.get(id);
    if (!instanceData) return;

    instanceData.isSelected = selected;
    this.updateInstanceColor(instanceData);
  }

  /**
   * Set hover state for an instance
   */
  public setHovered(id: string, hovered: boolean): void {
    const instanceData = this.instances.get(id);
    if (!instanceData) return;

    instanceData.isHovered = hovered;
    this.updateInstanceColor(instanceData);
  }

  /**
   * Update instance color based on state
   */
  private updateInstanceColor(instanceData: InstanceData): void {
    const mesh = this.instancedMeshes.get(instanceData.category);
    if (!mesh) return;

    const typeInfo = getFileTypeInfo(instanceData.fileData.extension);
    this.tempColor.set(typeInfo.color);
    
    // Modify color based on state
    if (instanceData.isSelected) {
      this.tempColor.lerp(new THREE.Color(0x00ff88), 0.4);
    } else if (instanceData.isHovered) {
      this.tempColor.lerp(new THREE.Color(0xffff00), 0.3);
    }
    
    mesh.setColorAt(instanceData.instanceIndex, this.tempColor);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Remove an instance
   */
  public removeInstance(id: string): boolean {
    const instanceData = this.instances.get(id);
    if (!instanceData) return false;

    const mesh = this.instancedMeshes.get(instanceData.category);
    if (!mesh) return false;

    const category = instanceData.category;
    const removedIndex = instanceData.instanceIndex;
    const count = this.categoryInstanceCounts.get(category) ?? 0;

    // Move the last instance to fill the gap
    if (removedIndex < count - 1) {
      // Find the last instance in this category
      for (const [, otherData] of this.instances) {
        if (otherData.category === category && otherData.instanceIndex === count - 1) {
          // Move last to removed position
          mesh.getMatrixAt(count - 1, this.tempMatrix);
          mesh.setMatrixAt(removedIndex, this.tempMatrix);
          
          mesh.getColorAt(count - 1, this.tempColor);
          mesh.setColorAt(removedIndex, this.tempColor);
          
          otherData.instanceIndex = removedIndex;
          break;
        }
      }
    }

    // Decrease count
    mesh.count = count - 1;
    this.categoryInstanceCounts.set(category, count - 1);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    
    this.instances.delete(id);
    return true;
  }

  /**
   * Expand a category's capacity
   */
  private expandCategory(category: FileCategory): void {
    const oldMesh = this.instancedMeshes.get(category);
    if (!oldMesh) return;

    const newCapacity = this.config.maxInstancesPerCategory * 2;
    const geometryType = getGeometryType(category);
    const geometry = this.createGeometry(geometryType, this.config.baseSize);
    
    const material = oldMesh.material as THREE.MeshStandardMaterial;
    const newMesh = new THREE.InstancedMesh(geometry, material, newCapacity);
    
    // Copy existing instances
    const count = oldMesh.count;
    for (let i = 0; i < count; i++) {
      oldMesh.getMatrixAt(i, this.tempMatrix);
      newMesh.setMatrixAt(i, this.tempMatrix);
      
      if (oldMesh.instanceColor) {
        oldMesh.getColorAt(i, this.tempColor);
        newMesh.setColorAt(i, this.tempColor);
      }
    }
    
    newMesh.count = count;
    newMesh.instanceMatrix.needsUpdate = true;
    if (newMesh.instanceColor) newMesh.instanceColor.needsUpdate = true;
    
    // Replace mesh
    this.parent.remove(oldMesh);
    oldMesh.geometry.dispose();
    
    this.instancedMeshes.set(category, newMesh);
    this.parent.add(newMesh);
    this.config.maxInstancesPerCategory = newCapacity;
  }

  /**
   * Get instance data by ID
   */
  public getInstance(id: string): InstanceData | undefined {
    return this.instances.get(id);
  }

  /**
   * Get all instances
   */
  public getAllInstances(): InstanceData[] {
    return Array.from(this.instances.values());
  }

  /**
   * Raycast against all instanced meshes
   */
  public raycast(raycaster: THREE.Raycaster): Array<{ id: string; point: THREE.Vector3; distance: number }> {
    const results: Array<{ id: string; point: THREE.Vector3; distance: number }> = [];
    
    for (const [category, mesh] of this.instancedMeshes) {
      const intersects = raycaster.intersectObject(mesh, false);
      
      for (const intersect of intersects) {
        const instanceId = intersect.instanceId;
        if (instanceId === undefined) continue;
        
        // Find the instance with this index in this category
        for (const [id, data] of this.instances) {
          if (data.category === category && data.instanceIndex === instanceId) {
            results.push({
              id,
              point: intersect.point.clone(),
              distance: intersect.distance,
            });
            break;
          }
        }
      }
    }
    
    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  /**
   * Update all instance matrices (call after physics update)
   */
  public updateMatrices(): void {
    const updateNeeded = new Set<FileCategory>();
    
    for (const [, data] of this.instances) {
      const mesh = this.instancedMeshes.get(data.category);
      if (!mesh) continue;
      
      mesh.setMatrixAt(data.instanceIndex, data.matrix);
      updateNeeded.add(data.category);
    }
    
    for (const category of updateNeeded) {
      const mesh = this.instancedMeshes.get(category);
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /**
   * Get statistics about instancing
   */
  public getStats(): { total: number; byCategory: Record<FileCategory, number> } {
    const byCategory: Record<string, number> = {};
    
    for (const [category, count] of this.categoryInstanceCounts) {
      byCategory[category] = count;
    }
    
    return {
      total: this.instances.size,
      byCategory: byCategory as Record<FileCategory, number>,
    };
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    for (const [, mesh] of this.instancedMeshes) {
      this.parent.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    
    this.instancedMeshes.clear();
    this.instances.clear();
    this.categoryInstanceCounts.clear();
  }
}
