import * as THREE from 'three';
import type { Boundary as BoundaryType, Vector3 } from '@/types';
import { DataObject3D } from './DataObject';

export interface Boundary3DConfig {
  fillColor?: number;
  strokeColor?: number;
  activeColor?: number;
  fillOpacity?: number;
  strokeWidth?: number;
  height?: number;
  showLabel?: boolean;
}

const DEFAULT_CONFIG: Boundary3DConfig = {
  fillColor: 0x4a9eff,
  strokeColor: 0x4a9eff,
  activeColor: 0x00ff88,
  fillOpacity: 0.15,
  strokeWidth: 2,
  height: 0.05,
  showLabel: true,
};

/**
 * 3D representation of a boundary zone on the data plane
 */
export class Boundary3D extends DataObject3D {
  private boundaryConfig: Boundary3DConfig;
  private boundaryData: BoundaryType;
  private lineMesh: THREE.Line | null = null;
  private labelSprite: THREE.Sprite | null = null;

  constructor(data: BoundaryType, config: Partial<Boundary3DConfig> = {}) {
    super(data);
    this.boundaryData = data;
    this.boundaryConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Apply boundary-specific color if set
    if (data.color) {
      const colorNum = parseInt(data.color.replace('#', ''), 16);
      this.boundaryConfig.fillColor = colorNum;
      this.boundaryConfig.strokeColor = colorNum;
    }
    
    this.build();
  }

  protected build(): void {
    const vertices = this.boundaryData.vertices;
    if (vertices.length < 3) return;

    this.createPolygonFill(vertices);
    this.createPolygonOutline(vertices);
    
    if (this.boundaryConfig.showLabel && this.boundaryData.label) {
      this.createLabel();
    }
  }

  /**
   * Create the filled polygon mesh
   */
  private createPolygonFill(vertices: Vector3[]): void {
    const shape = new THREE.Shape();
    
    const first = vertices[0];
    if (!first) return;
    
    // Create shape from vertices (assuming XZ plane projection)
    shape.moveTo(first.x, first.z);
    for (let i = 1; i < vertices.length; i++) {
      const v = vertices[i];
      if (v) {
        shape.lineTo(v.x, v.z);
      }
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    
    // Rotate to lie flat on XZ plane
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, this.boundaryConfig.height ?? 0.05, 0);

    const material = new THREE.MeshBasicMaterial({
      color: this.boundaryData.isActive 
        ? this.boundaryConfig.activeColor 
        : this.boundaryConfig.fillColor,
      transparent: true,
      opacity: this.boundaryConfig.fillOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mainMesh = new THREE.Mesh(geometry, material);
    this.mainMesh.userData.raycastable = true;
    this.mainMesh.renderOrder = 1;
    this.add(this.mainMesh);
  }

  /**
   * Create the polygon outline
   */
  private createPolygonOutline(vertices: Vector3[]): void {
    const points: THREE.Vector3[] = vertices.map(
      (v) => new THREE.Vector3(v.x, (this.boundaryConfig.height ?? 0.05) + 0.01, v.z)
    );
    // Close the loop
    const firstPoint = points[0];
    if (firstPoint) {
      points.push(firstPoint.clone());
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: this.boundaryData.isActive 
        ? this.boundaryConfig.activeColor 
        : this.boundaryConfig.strokeColor,
      linewidth: this.boundaryConfig.strokeWidth,
    });

    this.lineMesh = new THREE.Line(geometry, material);
    this.lineMesh.renderOrder = 2;
    this.add(this.lineMesh);
  }

  /**
   * Create label sprite
   */
  private createLabel(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 256;
    canvas.height = 64;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.roundRect(0, 0, canvas.width, canvas.height, 8);
    context.fill();

    // Text
    context.fillStyle = '#ffffff';
    context.font = 'bold 20px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    const label = this.boundaryData.label || 'Boundary';
    context.fillText(label, canvas.width / 2, canvas.height / 2 - 6);

    // Instructions count
    context.font = '14px Arial';
    context.fillStyle = '#888888';
    const instrCount = this.boundaryData.instructions.length;
    context.fillText(`${instrCount} instruction${instrCount !== 1 ? 's' : ''}`, canvas.width / 2, canvas.height / 2 + 14);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    this.labelSprite = new THREE.Sprite(spriteMaterial);
    
    // Position label at center of boundary
    const center = this.calculateCenter();
    this.labelSprite.position.set(center.x, 1, center.z);
    this.labelSprite.scale.set(2, 0.5, 1);
    this.labelSprite.userData.raycastable = false;
    this.add(this.labelSprite);
  }

  /**
   * Calculate the center point of the boundary
   */
  private calculateCenter(): Vector3 {
    const vertices = this.boundaryData.vertices;
    if (vertices.length === 0) return { x: 0, y: 0, z: 0 };

    const sum = vertices.reduce(
      (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }),
      { x: 0, y: 0, z: 0 }
    );

    return {
      x: sum.x / vertices.length,
      y: sum.y / vertices.length,
      z: sum.z / vertices.length,
    };
  }

  /**
   * Update boundary vertices
   */
  public updateVertices(vertices: Vector3[]): void {
    this.boundaryData.vertices = vertices;
    this.rebuild();
  }

  /**
   * Set active state
   */
  public setActive(active: boolean): void {
    this.boundaryData.isActive = active;
    this.updateActiveVisual();
  }

  /**
   * Update visual state based on active flag
   */
  private updateActiveVisual(): void {
    const color = this.boundaryData.isActive
      ? this.boundaryConfig.activeColor
      : this.boundaryConfig.fillColor;

    if (this.mainMesh) {
      (this.mainMesh.material as THREE.MeshBasicMaterial).color.setHex(color ?? 0x4a9eff);
    }
    if (this.lineMesh) {
      (this.lineMesh.material as THREE.LineBasicMaterial).color.setHex(color ?? 0x4a9eff);
    }
  }

  /**
   * Update boundary data
   */
  public updateBoundaryData(data: Partial<BoundaryType>): void {
    this.boundaryData = { ...this.boundaryData, ...data, updatedAt: Date.now() };
    super.updateData(data);
    
    if (data.vertices || data.color || data.label) {
      this.rebuild();
    } else if (data.isActive !== undefined) {
      this.updateActiveVisual();
    }
  }

  /**
   * Rebuild the boundary visual
   */
  private rebuild(): void {
    // Dispose old meshes
    if (this.mainMesh) {
      this.mainMesh.geometry.dispose();
      (this.mainMesh.material as THREE.Material).dispose();
      this.remove(this.mainMesh);
      this.mainMesh = null;
    }
    if (this.lineMesh) {
      this.lineMesh.geometry.dispose();
      (this.lineMesh.material as THREE.Material).dispose();
      this.remove(this.lineMesh);
      this.lineMesh = null;
    }
    if (this.labelSprite) {
      (this.labelSprite.material as THREE.SpriteMaterial).map?.dispose();
      this.labelSprite.material.dispose();
      this.remove(this.labelSprite);
      this.labelSprite = null;
    }

    this.build();
  }

  /**
   * Get boundary data
   */
  public getBoundaryData(): BoundaryType {
    return this.boundaryData;
  }

  /**
   * Check if a point is inside the boundary (XZ plane)
   */
  public containsPoint(point: Vector3): boolean {
    const vertices = this.boundaryData.vertices;
    if (vertices.length < 3) return false;

    // Ray casting algorithm for point-in-polygon
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
   * Get the closest point on boundary edge to a given point
   */
  public getClosestEdgePoint(point: Vector3): { point: Vector3; edgeIndex: number; distance: number } | null {
    const vertices = this.boundaryData.vertices;
    if (vertices.length < 2) return null;

    let closestPoint: Vector3 | null = null;
    let closestEdgeIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      const a = vertices[i];
      const b = vertices[j];
      
      if (!a || !b) continue;

      // Project point onto edge (XZ plane)
      const edgeVec = { x: b.x - a.x, z: b.z - a.z };
      const pointVec = { x: point.x - a.x, z: point.z - a.z };
      const edgeLengthSq = edgeVec.x * edgeVec.x + edgeVec.z * edgeVec.z;
      
      if (edgeLengthSq === 0) continue;

      const t = Math.max(0, Math.min(1, 
        (pointVec.x * edgeVec.x + pointVec.z * edgeVec.z) / edgeLengthSq
      ));

      const projected = {
        x: a.x + t * edgeVec.x,
        y: point.y,
        z: a.z + t * edgeVec.z,
      };

      const dx = point.x - projected.x;
      const dz = point.z - projected.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = projected;
        closestEdgeIndex = i;
      }
    }

    return closestPoint 
      ? { point: closestPoint, edgeIndex: closestEdgeIndex, distance: minDistance }
      : null;
  }

  public override dispose(): void {
    if (this.lineMesh) {
      this.lineMesh.geometry.dispose();
      (this.lineMesh.material as THREE.Material).dispose();
    }
    if (this.labelSprite) {
      (this.labelSprite.material as THREE.SpriteMaterial).map?.dispose();
    }
    super.dispose();
  }
}
