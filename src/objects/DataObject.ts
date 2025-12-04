import * as THREE from 'three';
import type { DataObject as DataObjectType, Vector3 } from '@/types';

export interface DataObject3DConfig {
  selectionColor?: number;
  hoverColor?: number;
  selectionOutlineWidth?: number;
}

const DEFAULT_CONFIG: DataObject3DConfig = {
  selectionColor: 0x00ff88,
  hoverColor: 0xffff00,
  selectionOutlineWidth: 0.05,
};

/**
 * Base class for all 3D data objects on the plane
 */
export abstract class DataObject3D extends THREE.Group {
  public readonly objectId: string;
  protected data: DataObjectType;
  protected config: DataObject3DConfig;
  
  protected mainMesh: THREE.Mesh | null = null;
  protected outlineMesh: THREE.Mesh | null = null;
  protected isHovered: boolean = false;
  protected _isSelected: boolean = false;

  constructor(data: DataObjectType, config: Partial<DataObject3DConfig> = {}) {
    super();
    
    this.objectId = data.id;
    this.data = data;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Set Three.js object name for lookup
    this.name = data.id;
    
    // Set initial position
    this.position.set(data.position.x, data.position.y, data.position.z);
    this.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
    this.scale.set(data.scale.x, data.scale.y, data.scale.z);
    
    // Mark as data object for raycasting
    this.userData.isDataObject = true;
    this.userData.objectId = data.id;
    this.userData.objectType = data.type;
  }

  /**
   * Get the current data state
   */
  public getData(): DataObjectType {
    return this.data;
  }

  /**
   * Update data and apply changes to 3D representation
   */
  public updateData(changes: Partial<DataObjectType>): void {
    this.data = { ...this.data, ...changes, updatedAt: Date.now() };
    
    if (changes.position) {
      this.position.set(changes.position.x, changes.position.y, changes.position.z);
    }
    if (changes.rotation) {
      this.rotation.set(changes.rotation.x, changes.rotation.y, changes.rotation.z);
    }
    if (changes.scale) {
      this.scale.set(changes.scale.x, changes.scale.y, changes.scale.z);
    }
    if (changes.isSelected !== undefined) {
      this.setSelected(changes.isSelected);
    }
  }

  /**
   * Set world position
   */
  public setWorldPosition(position: Vector3): void {
    this.position.set(position.x, position.y, position.z);
    this.data.position = position;
  }

  /**
   * Get world position
   */
  public getWorldPosition3(): Vector3 {
    const pos = new THREE.Vector3();
    this.getWorldPosition(pos);
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  /**
   * Set selection state with visual feedback
   */
  public setSelected(selected: boolean): void {
    this._isSelected = selected;
    this.data.isSelected = selected;
    this.updateSelectionVisual();
  }

  /**
   * Get selection state
   */
  public get isSelected(): boolean {
    return this._isSelected;
  }

  /**
   * Set hover state with visual feedback
   */
  public setHovered(hovered: boolean): void {
    if (this.isHovered === hovered) return;
    this.isHovered = hovered;
    this.updateHoverVisual();
  }

  /**
   * Update visual to reflect selection state
   */
  protected updateSelectionVisual(): void {
    if (!this.outlineMesh) return;
    
    this.outlineMesh.visible = this._isSelected;
    if (this._isSelected && this.outlineMesh.material instanceof THREE.MeshBasicMaterial) {
      this.outlineMesh.material.color.setHex(this.config.selectionColor ?? 0x00ff88);
    }
  }

  /**
   * Update visual to reflect hover state
   */
  protected updateHoverVisual(): void {
    if (!this.mainMesh) return;
    
    const material = this.mainMesh.material as THREE.MeshStandardMaterial;
    if (this.isHovered) {
      material.emissive.setHex(this.config.hoverColor ?? 0xffff00);
      material.emissiveIntensity = 0.2;
    } else {
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
    }
  }

  /**
   * Create an outline mesh for selection visualization
   */
  protected createOutlineMesh(geometry: THREE.BufferGeometry, scale: number = 1.1): THREE.Mesh {
    const outlineGeometry = geometry.clone();
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: this.config.selectionColor,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.5,
    });
    
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.scale.multiplyScalar(scale);
    outline.visible = false;
    outline.renderOrder = -1;
    
    return outline;
  }

  /**
   * Get the main mesh for raycasting
   */
  public getMainMesh(): THREE.Mesh | null {
    return this.mainMesh;
  }

  /**
   * Get all meshes for raycasting
   */
  public getRaycastMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    this.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.raycastable !== false) {
        meshes.push(child);
      }
    });
    return meshes;
  }

  /**
   * Abstract method to build the 3D representation
   */
  protected abstract build(): void;

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        } else if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        }
      }
    });
    
    this.clear();
  }
}
