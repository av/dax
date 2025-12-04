import * as THREE from 'three';
import type { Beacon as BeaconType, BeaconType as BeaconKind, Vector3 } from '@/types';
import { DataObject3D } from './DataObject';

export interface Beacon3DConfig {
  baseHeight?: number;
  pulseDuration?: number;
  showRadius?: boolean;
}

const DEFAULT_CONFIG: Beacon3DConfig = {
  baseHeight: 2,
  pulseDuration: 2,
  showRadius: true,
};

// Beacon type colors
const BEACON_COLORS: Record<BeaconKind, number> = {
  attract: 0x00ff88,
  repel: 0xff4444,
  speed: 0xffff00,
  careful: 0xff9900,
  notify: 0x4a9eff,
  pause: 0x888888,
};

// Beacon type icons
const BEACON_ICONS: Record<BeaconKind, string> = {
  attract: '⬆',
  repel: '⬇',
  speed: '⚡',
  careful: '⚠',
  notify: '🔔',
  pause: '⏸',
};

/**
 * 3D representation of a beacon that modulates agent behavior
 */
export class Beacon3D extends DataObject3D {
  private beaconConfig: Beacon3DConfig;
  private beaconData: BeaconType;
  private radiusMesh: THREE.Mesh | null = null;
  private lightSource: THREE.PointLight | null = null;
  private labelSprite: THREE.Sprite | null = null;
  private pulseTime: number = 0;

  constructor(data: BeaconType, config: Partial<Beacon3DConfig> = {}) {
    super(data);
    this.beaconData = data;
    this.beaconConfig = { ...DEFAULT_CONFIG, ...config };
    this.build();
  }

  protected build(): void {
    const color = BEACON_COLORS[this.beaconData.beaconType] ?? 0xffffff;
    
    this.createBeaconBody(color);
    this.createRadiusIndicator(color);
    this.createLight(color);
    this.createLabel();
  }

  /**
   * Create the main beacon body
   */
  private createBeaconBody(color: number): void {
    const height = this.beaconConfig.baseHeight ?? 2;
    const baseRadius = 0.3;

    // Create tapered cylinder (cone-like)
    const geometry = new THREE.CylinderGeometry(
      baseRadius * 0.3, // Top radius
      baseRadius,       // Bottom radius
      height,
      8
    );

    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.3,
      metalness: 0.7,
      emissive: color,
      emissiveIntensity: this.beaconData.isActive ? 0.5 : 0.1,
    });

    this.mainMesh = new THREE.Mesh(geometry, material);
    this.mainMesh.position.y = height / 2;
    this.mainMesh.castShadow = true;
    this.mainMesh.userData.raycastable = true;
    this.add(this.mainMesh);

    // Add glow sphere at top
    const glowGeometry = new THREE.SphereGeometry(baseRadius * 0.5, 16, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
    });
    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    glowSphere.position.y = height + baseRadius * 0.3;
    glowSphere.userData.raycastable = false;
    this.add(glowSphere);

    // Create selection outline
    this.outlineMesh = this.createOutlineMesh(geometry, 1.15);
    this.outlineMesh.position.copy(this.mainMesh.position);
    this.add(this.outlineMesh);
  }

  /**
   * Create radius indicator ring
   */
  private createRadiusIndicator(color: number): void {
    if (!this.beaconConfig.showRadius) return;

    const radius = this.beaconData.radius;
    const segments = 64;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0.02,
        Math.sin(angle) * radius
      ));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: this.beaconData.isActive ? 0.5 : 0.2,
    });

    const ring = new THREE.Line(geometry, material);
    this.add(ring);

    // Create filled disc for radius
    const discGeometry = new THREE.CircleGeometry(radius, segments);
    discGeometry.rotateX(-Math.PI / 2);
    discGeometry.translate(0, 0.01, 0);

    const discMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: this.beaconData.isActive ? 0.1 : 0.03,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.radiusMesh = new THREE.Mesh(discGeometry, discMaterial);
    this.radiusMesh.renderOrder = 0;
    this.add(this.radiusMesh);
  }

  /**
   * Create point light for the beacon
   */
  private createLight(color: number): void {
    const height = this.beaconConfig.baseHeight ?? 2;
    const intensity = this.beaconData.intensity * (this.beaconData.isActive ? 2 : 0.5);

    this.lightSource = new THREE.PointLight(color, intensity, this.beaconData.radius * 2);
    this.lightSource.position.y = height + 0.5;
    this.add(this.lightSource);
  }

  /**
   * Create label sprite
   */
  private createLabel(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 128;
    canvas.height = 128;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Background circle
    const color = BEACON_COLORS[this.beaconData.beaconType] ?? 0xffffff;
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.globalAlpha = 0.8;
    context.beginPath();
    context.arc(64, 64, 56, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;

    // Icon
    const icon = BEACON_ICONS[this.beaconData.beaconType] ?? '?';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(icon, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    this.labelSprite = new THREE.Sprite(spriteMaterial);
    const height = this.beaconConfig.baseHeight ?? 2;
    this.labelSprite.position.y = height + 1.5;
    this.labelSprite.scale.set(1, 1, 1);
    this.labelSprite.userData.raycastable = false;
    this.add(this.labelSprite);
  }

  /**
   * Update beacon animation (call in animation loop)
   */
  public update(deltaTime: number): void {
    if (!this.beaconData.isActive) return;

    this.pulseTime += deltaTime;
    const pulseDuration = this.beaconConfig.pulseDuration ?? 2;
    const pulsePhase = (this.pulseTime % pulseDuration) / pulseDuration;
    const pulseValue = Math.sin(pulsePhase * Math.PI * 2) * 0.5 + 0.5;

    // Animate main mesh emissive
    if (this.mainMesh) {
      const material = this.mainMesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + pulseValue * 0.4;
    }

    // Animate light intensity
    if (this.lightSource) {
      this.lightSource.intensity = this.beaconData.intensity * (1 + pulseValue * 0.5);
    }

    // Animate radius disc
    if (this.radiusMesh) {
      const material = this.radiusMesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.05 + pulseValue * 0.1;
    }
  }

  /**
   * Set active state
   */
  public setActive(active: boolean): void {
    this.beaconData.isActive = active;
    
    if (this.mainMesh) {
      const material = this.mainMesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = active ? 0.5 : 0.1;
    }
    
    if (this.lightSource) {
      this.lightSource.intensity = this.beaconData.intensity * (active ? 2 : 0.5);
    }

    if (this.radiusMesh) {
      const material = this.radiusMesh.material as THREE.MeshBasicMaterial;
      material.opacity = active ? 0.1 : 0.03;
    }
  }

  /**
   * Update beacon radius
   */
  public setRadius(radius: number): void {
    this.beaconData.radius = radius;
    this.rebuild();
  }

  /**
   * Update beacon data
   */
  public updateBeaconData(data: Partial<BeaconType>): void {
    this.beaconData = { ...this.beaconData, ...data, updatedAt: Date.now() };
    super.updateData(data);

    if (data.radius !== undefined || data.beaconType !== undefined || data.color !== undefined) {
      this.rebuild();
    } else if (data.isActive !== undefined) {
      this.setActive(data.isActive);
    } else if (data.intensity !== undefined && this.lightSource) {
      this.lightSource.intensity = data.intensity * (this.beaconData.isActive ? 2 : 0.5);
    }
  }

  /**
   * Get beacon data
   */
  public getBeaconData(): BeaconType {
    return this.beaconData;
  }

  /**
   * Check if a point is within the beacon's radius
   */
  public isPointInRange(point: Vector3): boolean {
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance <= this.beaconData.radius;
  }

  /**
   * Calculate influence on a point (0 to 1 based on distance)
   */
  public getInfluence(point: Vector3): number {
    if (!this.beaconData.isActive) return 0;

    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance >= this.beaconData.radius) return 0;
    
    // Linear falloff from center
    const normalizedDistance = distance / this.beaconData.radius;
    return (1 - normalizedDistance) * this.beaconData.intensity;
  }

  /**
   * Rebuild the beacon visual
   */
  private rebuild(): void {
    // Dispose all children
    this.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
      if (child instanceof THREE.Line) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    this.clear();
    
    this.mainMesh = null;
    this.outlineMesh = null;
    this.radiusMesh = null;
    this.lightSource = null;
    this.labelSprite = null;

    this.build();
  }

  public override dispose(): void {
    if (this.lightSource) {
      this.lightSource.dispose();
    }
    if (this.labelSprite) {
      (this.labelSprite.material as THREE.SpriteMaterial).map?.dispose();
    }
    super.dispose();
  }
}
