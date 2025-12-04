import * as THREE from 'three';
import { SIZES } from '@/types';

/**
 * Configuration for LOD management
 */
export interface LODManagerConfig {
  /** Near distance threshold - full detail */
  nearDistance: number;
  /** Mid distance threshold - reduced detail */
  midDistance: number;
  /** Far distance threshold - minimal detail */
  farDistance: number;
  /** Enable automatic LOD updates based on camera */
  autoUpdate: boolean;
  /** Update interval in frames (1 = every frame) */
  updateInterval: number;
}

const DEFAULT_CONFIG: LODManagerConfig = {
  nearDistance: SIZES.lodNear,
  midDistance: SIZES.lodMid,
  farDistance: SIZES.lodFar,
  autoUpdate: true,
  updateInterval: 3, // Update every 3 frames for performance
};

/**
 * LOD levels
 */
export type LODLevel = 'high' | 'medium' | 'low' | 'culled';

/**
 * Object registration info
 */
interface LODObjectInfo {
  object: THREE.Object3D;
  lodObject?: THREE.LOD;
  currentLevel: LODLevel;
  onLevelChange?: (level: LODLevel) => void;
  customDistances?: {
    near: number;
    mid: number;
    far: number;
  };
}

/**
 * Manages Level of Detail for scene objects
 * 
 * Automatically adjusts object detail based on camera distance
 * to improve rendering performance when many objects are visible.
 */
export class LODManager {
  private config: LODManagerConfig;
  private camera: THREE.Camera;
  private objects: Map<string, LODObjectInfo> = new Map();
  private frameCount: number = 0;
  private enabled: boolean = true;

  // Temporary vectors for calculations
  private tempCameraPos = new THREE.Vector3();
  private tempObjectPos = new THREE.Vector3();

  constructor(camera: THREE.Camera, config: Partial<LODManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.camera = camera;
  }

  /**
   * Register an object for LOD management
   */
  public register(
    id: string,
    object: THREE.Object3D,
    options?: {
      onLevelChange?: (level: LODLevel) => void;
      customDistances?: { near: number; mid: number; far: number };
    }
  ): void {
    this.objects.set(id, {
      object,
      currentLevel: 'high',
      onLevelChange: options?.onLevelChange,
      customDistances: options?.customDistances,
    });
  }

  /**
   * Register a Three.js LOD object for automatic management
   */
  public registerLOD(
    id: string,
    lodObject: THREE.LOD,
    options?: {
      onLevelChange?: (level: LODLevel) => void;
    }
  ): void {
    this.objects.set(id, {
      object: lodObject,
      lodObject,
      currentLevel: 'high',
      onLevelChange: options?.onLevelChange,
    });
  }

  /**
   * Unregister an object
   */
  public unregister(id: string): void {
    this.objects.delete(id);
  }

  /**
   * Update LOD levels for all registered objects
   * Should be called in the render loop
   */
  public update(): void {
    if (!this.enabled || !this.config.autoUpdate) return;

    this.frameCount++;
    if (this.frameCount < this.config.updateInterval) return;
    this.frameCount = 0;

    this.camera.getWorldPosition(this.tempCameraPos);

    for (const [id, info] of this.objects) {
      this.updateObject(id, info);
    }
  }

  /**
   * Update LOD for a single object
   */
  private updateObject(_id: string, info: LODObjectInfo): void {
    // If it's a native THREE.LOD, let it handle itself
    if (info.lodObject) {
      info.lodObject.update(this.camera);
      return;
    }

    info.object.getWorldPosition(this.tempObjectPos);
    const distance = this.tempCameraPos.distanceTo(this.tempObjectPos);

    const distances = info.customDistances ?? {
      near: this.config.nearDistance,
      mid: this.config.midDistance,
      far: this.config.farDistance,
    };

    let newLevel: LODLevel;
    
    if (distance < distances.near) {
      newLevel = 'high';
    } else if (distance < distances.mid) {
      newLevel = 'medium';
    } else if (distance < distances.far) {
      newLevel = 'low';
    } else {
      newLevel = 'culled';
    }

    if (newLevel !== info.currentLevel) {
      info.currentLevel = newLevel;
      this.applyLODLevel(info, newLevel);
      info.onLevelChange?.(newLevel);
    }
  }

  /**
   * Apply LOD level to an object
   */
  private applyLODLevel(info: LODObjectInfo, level: LODLevel): void {
    switch (level) {
      case 'high':
        info.object.visible = true;
        this.setObjectDetail(info.object, 1.0);
        break;
      case 'medium':
        info.object.visible = true;
        this.setObjectDetail(info.object, 0.5);
        break;
      case 'low':
        info.object.visible = true;
        this.setObjectDetail(info.object, 0.25);
        break;
      case 'culled':
        info.object.visible = false;
        break;
    }
  }

  /**
   * Set detail level on an object (affects children)
   */
  private setObjectDetail(object: THREE.Object3D, detail: number): void {
    object.traverse((child) => {
      // Skip labels and sprites at low detail
      if (child instanceof THREE.Sprite) {
        child.visible = detail > 0.5;
      }
      
      // Reduce shadow complexity at low detail
      if (child instanceof THREE.Mesh) {
        child.castShadow = detail > 0.5;
      }
      
      // Store detail level for custom handling
      child.userData.lodDetail = detail;
    });
  }

  /**
   * Force update LOD for a specific object
   */
  public forceUpdate(id: string): void {
    const info = this.objects.get(id);
    if (info) {
      this.updateObject(id, info);
    }
  }

  /**
   * Force update all objects
   */
  public forceUpdateAll(): void {
    this.camera.getWorldPosition(this.tempCameraPos);
    for (const [id, info] of this.objects) {
      this.updateObject(id, info);
    }
  }

  /**
   * Get current LOD level for an object
   */
  public getLevel(id: string): LODLevel | undefined {
    return this.objects.get(id)?.currentLevel;
  }

  /**
   * Enable/disable LOD management
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    
    if (!enabled) {
      // Reset all to high detail when disabled
      for (const [, info] of this.objects) {
        info.currentLevel = 'high';
        this.applyLODLevel(info, 'high');
      }
    }
  }

  /**
   * Update configuration
   */
  public setConfig(config: Partial<LODManagerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get statistics about current LOD distribution
   */
  public getStats(): Record<LODLevel, number> {
    const stats: Record<LODLevel, number> = {
      high: 0,
      medium: 0,
      low: 0,
      culled: 0,
    };

    for (const [, info] of this.objects) {
      stats[info.currentLevel]++;
    }

    return stats;
  }

  /**
   * Create a simple LOD object with multiple geometry levels
   */
  public static createSimpleLOD(
    geometries: { distance: number; geometry: THREE.BufferGeometry; material: THREE.Material }[]
  ): THREE.LOD {
    const lod = new THREE.LOD();

    for (const { distance, geometry, material } of geometries) {
      const mesh = new THREE.Mesh(geometry, material);
      lod.addLevel(mesh, distance);
    }

    return lod;
  }

  /**
   * Create LOD geometries for common shapes
   * Returns geometries at different detail levels
   */
  public static createLODGeometries(
    type: 'box' | 'sphere' | 'cylinder',
    size: number
  ): { high: THREE.BufferGeometry; medium: THREE.BufferGeometry; low: THREE.BufferGeometry } {
    switch (type) {
      case 'box':
        return {
          high: new THREE.BoxGeometry(size, size, size, 4, 4, 4),
          medium: new THREE.BoxGeometry(size, size, size, 2, 2, 2),
          low: new THREE.BoxGeometry(size, size, size, 1, 1, 1),
        };
      case 'sphere':
        return {
          high: new THREE.SphereGeometry(size / 2, 32, 24),
          medium: new THREE.SphereGeometry(size / 2, 16, 12),
          low: new THREE.SphereGeometry(size / 2, 8, 6),
        };
      case 'cylinder':
        return {
          high: new THREE.CylinderGeometry(size / 2, size / 2, size, 32),
          medium: new THREE.CylinderGeometry(size / 2, size / 2, size, 16),
          low: new THREE.CylinderGeometry(size / 2, size / 2, size, 8),
        };
      default:
        return {
          high: new THREE.BoxGeometry(size, size, size),
          medium: new THREE.BoxGeometry(size, size, size),
          low: new THREE.BoxGeometry(size, size, size),
        };
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.objects.clear();
  }
}
