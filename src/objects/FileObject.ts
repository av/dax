import * as THREE from 'three';
import type { FileObject as FileObjectType } from '@/types';
import { DataObject3D } from './DataObject';
import { getFileTypeInfo, getFileSizeMultiplier, getGeometryType, type GeometryType } from '@/services/fileTypes';

export interface FileObject3DConfig {
  baseSize?: number;
  labelHeight?: number;
  showLabel?: boolean;
}

const DEFAULT_CONFIG: FileObject3DConfig = {
  baseSize: 1,
  labelHeight: 0.5,
  showLabel: true,
};

/**
 * 3D representation of a file on the data plane
 */
export class FileObject3D extends DataObject3D {
  private labelSprite: THREE.Sprite | null = null;
  private fileConfig: FileObject3DConfig;
  private fileData: FileObjectType;

  constructor(data: FileObjectType, config: Partial<FileObject3DConfig> = {}) {
    super(data);
    this.fileData = data;
    this.fileConfig = { ...DEFAULT_CONFIG, ...config };
    this.build();
  }

  protected build(): void {
    const typeInfo = getFileTypeInfo(this.fileData.extension);
    const sizeMultiplier = getFileSizeMultiplier(this.fileData.sizeBytes);
    const geometryType = getGeometryType(this.fileData.category);
    const baseSize = (this.fileConfig.baseSize ?? 1) * sizeMultiplier;

    // Create main geometry based on file type
    const geometry = this.createGeometry(geometryType, baseSize);
    
    // Create material with file type color
    const material = new THREE.MeshStandardMaterial({
      color: typeInfo.color,
      roughness: 0.6,
      metalness: 0.2,
      flatShading: true,
    });

    this.mainMesh = new THREE.Mesh(geometry, material);
    this.mainMesh.castShadow = true;
    this.mainMesh.receiveShadow = true;
    this.mainMesh.userData.raycastable = true;
    this.mainMesh.position.y = baseSize / 2; // Lift above ground
    this.add(this.mainMesh);

    // Create selection outline
    this.outlineMesh = this.createOutlineMesh(geometry, 1.15);
    this.outlineMesh.position.copy(this.mainMesh.position);
    this.add(this.outlineMesh);

    // Create label
    if (this.fileConfig.showLabel) {
      this.createLabel(baseSize);
    }
  }

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

  private createLabel(baseSize: number): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size
    canvas.width = 256;
    canvas.height = 64;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.roundRect(0, 0, canvas.width, canvas.height, 8);
    context.fill();

    // Draw text
    context.fillStyle = '#ffffff';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Truncate filename if too long
    let displayName = this.fileData.name;
    const maxWidth = canvas.width - 20;
    while (context.measureText(displayName).width > maxWidth && displayName.length > 3) {
      displayName = displayName.slice(0, -4) + '...';
    }
    
    context.fillText(displayName, canvas.width / 2, canvas.height / 2);

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    this.labelSprite = new THREE.Sprite(spriteMaterial);
    this.labelSprite.scale.set(2, 0.5, 1);
    this.labelSprite.position.y = baseSize + (this.fileConfig.labelHeight ?? 0.5);
    this.labelSprite.userData.raycastable = false;
    this.add(this.labelSprite);
  }

  /**
   * Update file data and refresh visual
   */
  public updateFileData(data: Partial<FileObjectType>): void {
    this.fileData = { ...this.fileData, ...data, updatedAt: Date.now() };
    super.updateData(data);
    
    // If category changed, rebuild geometry
    if (data.category || data.extension) {
      this.rebuild();
    }
  }

  /**
   * Rebuild the 3D representation
   */
  private rebuild(): void {
    // Dispose old resources
    if (this.mainMesh) {
      this.mainMesh.geometry.dispose();
      (this.mainMesh.material as THREE.Material).dispose();
      this.remove(this.mainMesh);
    }
    if (this.outlineMesh) {
      this.outlineMesh.geometry.dispose();
      (this.outlineMesh.material as THREE.Material).dispose();
      this.remove(this.outlineMesh);
    }
    if (this.labelSprite) {
      (this.labelSprite.material as THREE.SpriteMaterial).map?.dispose();
      this.labelSprite.material.dispose();
      this.remove(this.labelSprite);
    }
    
    // Rebuild
    this.build();
    
    // Restore selection state
    if (this._isSelected) {
      this.updateSelectionVisual();
    }
  }

  /**
   * Get file-specific data
   */
  public getFileData(): FileObjectType {
    return this.fileData;
  }

  /**
   * Show/hide label
   */
  public setLabelVisible(visible: boolean): void {
    if (this.labelSprite) {
      this.labelSprite.visible = visible;
    }
  }

  /**
   * Set "being edited" indicator
   */
  public setEditingState(isEditing: boolean): void {
    if (!this.mainMesh) return;
    
    const material = this.mainMesh.material as THREE.MeshStandardMaterial;
    if (isEditing) {
      material.emissive.setHex(0x00ffff);
      material.emissiveIntensity = 0.3;
    } else if (!this.isHovered) {
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
    }
  }

  /**
   * Set "being analyzed" indicator (agent is looking at this)
   */
  public setAnalyzingState(isBeingAnalyzed: boolean): void {
    if (!this.mainMesh) return;
    
    const material = this.mainMesh.material as THREE.MeshStandardMaterial;
    if (isBeingAnalyzed) {
      material.emissive.setHex(0xff00ff);
      material.emissiveIntensity = 0.4;
    } else if (!this.isHovered) {
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
    }
  }

  public override dispose(): void {
    if (this.labelSprite) {
      (this.labelSprite.material as THREE.SpriteMaterial).map?.dispose();
    }
    super.dispose();
  }
}
