import * as THREE from 'three';
import type { Snippet as SnippetType, Vector3 } from '@/types';
import { DataObject3D } from './DataObject';

export interface Snippet3DConfig {
  baseSize?: number;
  labelHeight?: number;
  maxPreviewLines?: number;
}

const DEFAULT_CONFIG: Snippet3DConfig = {
  baseSize: 0.8,
  labelHeight: 0.4,
  maxPreviewLines: 5,
};

// Default colors for snippets
const TAG_COLORS: Record<string, number> = {
  note: 0xffd700,
  todo: 0xff6b6b,
  idea: 0x4ecdc4,
  code: 0x45b7d1,
  reference: 0x96ceb4,
  default: 0xc9b1ff,
};

/**
 * 3D representation of a data snippet on the plane
 */
export class Snippet3D extends DataObject3D {
  private snippetConfig: Snippet3DConfig;
  private snippetData: SnippetType;
  private labelSprite: THREE.Sprite | null = null;
  private contentSprite: THREE.Sprite | null = null;
  private linkLine: THREE.Line | null = null;
  private linkedObjectId: string | null = null;

  constructor(data: SnippetType, config: Partial<Snippet3DConfig> = {}) {
    super(data);
    this.snippetData = data;
    this.snippetConfig = { ...DEFAULT_CONFIG, ...config };
    this.build();
  }

  protected build(): void {
    const color = this.getSnippetColor();
    
    this.createSnippetBody(color);
    this.createTitleLabel();
    this.createContentPreview();
  }

  /**
   * Get color based on snippet color or first tag
   */
  private getSnippetColor(): number {
    if (this.snippetData.color) {
      return parseInt(this.snippetData.color.replace('#', ''), 16);
    }
    
    const firstTag = this.snippetData.tags[0];
    if (firstTag && TAG_COLORS[firstTag]) {
      return TAG_COLORS[firstTag] ?? TAG_COLORS['default'] ?? 0xc9b1ff;
    }
    
    return TAG_COLORS['default'] ?? 0xc9b1ff;
  }

  /**
   * Create the main snippet body (sticky note style)
   */
  private createSnippetBody(color: number): void {
    const size = this.snippetConfig.baseSize ?? 0.8;
    
    // Create a thin box (like a sticky note)
    const geometry = new THREE.BoxGeometry(size * 1.2, size * 0.1, size);

    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.4,
      metalness: 0.1,
      flatShading: true,
    });

    this.mainMesh = new THREE.Mesh(geometry, material);
    this.mainMesh.position.y = size * 0.05; // Slightly above ground
    this.mainMesh.rotation.x = -0.1; // Slight tilt like a paper
    this.mainMesh.castShadow = true;
    this.mainMesh.userData.raycastable = true;
    this.add(this.mainMesh);

    // Selection outline
    this.outlineMesh = this.createOutlineMesh(geometry, 1.15);
    this.outlineMesh.position.copy(this.mainMesh.position);
    this.outlineMesh.rotation.copy(this.mainMesh.rotation);
    this.add(this.outlineMesh);
  }

  /**
   * Create title label sprite
   */
  private createTitleLabel(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 256;
    canvas.height = 48;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Title text
    const title = this.snippetData.title || 'Snippet';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    
    // Truncate if needed
    let displayTitle = title;
    const maxWidth = canvas.width - 20;
    while (context.measureText(displayTitle).width > maxWidth && displayTitle.length > 3) {
      displayTitle = displayTitle.slice(0, -4) + '...';
    }
    
    context.fillText(displayTitle, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    this.labelSprite = new THREE.Sprite(spriteMaterial);
    const size = this.snippetConfig.baseSize ?? 0.8;
    this.labelSprite.position.y = size + 0.3;
    this.labelSprite.scale.set(2, 0.4, 1);
    this.labelSprite.userData.raycastable = false;
    this.add(this.labelSprite);
  }

  /**
   * Create content preview sprite
   */
  private createContentPreview(): void {
    const content = this.snippetData.content;
    if (!content) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 256;
    canvas.height = 128;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.roundRect(0, 0, canvas.width, canvas.height, 8);
    context.fill();

    // Content text
    context.font = '14px Monaco, monospace';
    context.fillStyle = '#cccccc';
    context.textAlign = 'left';
    
    const maxLines = this.snippetConfig.maxPreviewLines ?? 5;
    const lines = content.split('\n').slice(0, maxLines);
    const lineHeight = 20;
    const startY = 18;
    const maxWidth = canvas.width - 20;

    lines.forEach((line, i) => {
      let displayLine = line;
      while (context.measureText(displayLine).width > maxWidth && displayLine.length > 3) {
        displayLine = displayLine.slice(0, -4) + '...';
      }
      context.fillText(displayLine, 10, startY + i * lineHeight);
    });

    // "More" indicator
    if (content.split('\n').length > maxLines) {
      context.fillStyle = '#666666';
      context.fillText('...', 10, startY + maxLines * lineHeight);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    this.contentSprite = new THREE.Sprite(spriteMaterial);
    const size = this.snippetConfig.baseSize ?? 0.8;
    this.contentSprite.position.y = size + 0.9;
    this.contentSprite.scale.set(2.5, 1.25, 1);
    this.contentSprite.visible = false; // Hidden by default, show on hover
    this.contentSprite.userData.raycastable = false;
    this.add(this.contentSprite);
  }

  /**
   * Update snippet data
   */
  public updateSnippetData(data: Partial<SnippetType>): void {
    this.snippetData = { ...this.snippetData, ...data, updatedAt: Date.now() };
    super.updateData(data);

    if (data.content !== undefined || data.title !== undefined || 
        data.color !== undefined || data.tags !== undefined) {
      this.rebuild();
    }
  }

  /**
   * Get snippet data
   */
  public getSnippetData(): SnippetType {
    return this.snippetData;
  }

  /**
   * Show content preview (on hover)
   */
  public showContentPreview(show: boolean): void {
    if (this.contentSprite) {
      this.contentSprite.visible = show;
    }
  }

  /**
   * Set hover state with content preview
   */
  public override setHovered(hovered: boolean): void {
    super.setHovered(hovered);
    this.showContentPreview(hovered);
  }

  /**
   * Link to another object (file)
   */
  public linkTo(objectId: string, targetPosition: Vector3): void {
    this.linkedObjectId = objectId;
    this.updateLinkVisual(targetPosition);
  }

  /**
   * Remove link
   */
  public unlink(): void {
    this.linkedObjectId = null;
    if (this.linkLine) {
      this.remove(this.linkLine);
      this.linkLine.geometry.dispose();
      (this.linkLine.material as THREE.Material).dispose();
      this.linkLine = null;
    }
  }

  /**
   * Update link line visual
   */
  public updateLinkVisual(targetPosition: Vector3): void {
    if (!this.linkedObjectId) return;

    // Remove old line
    if (this.linkLine) {
      this.remove(this.linkLine);
      this.linkLine.geometry.dispose();
      (this.linkLine.material as THREE.Material).dispose();
    }

    // Create new line
    const points = [
      new THREE.Vector3(0, 0.2, 0), // Start at snippet
      new THREE.Vector3(
        targetPosition.x - this.position.x,
        targetPosition.y + 0.5,
        targetPosition.z - this.position.z
      ), // End at target
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: this.getSnippetColor(),
      dashSize: 0.2,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.6,
    });

    this.linkLine = new THREE.Line(geometry, material);
    this.linkLine.computeLineDistances();
    this.add(this.linkLine);
  }

  /**
   * Get linked object ID
   */
  public getLinkedObjectId(): string | null {
    return this.linkedObjectId;
  }

  /**
   * Check if editing should be initiated
   */
  public isEditable(): boolean {
    return true;
  }

  /**
   * Rebuild the snippet visual
   */
  private rebuild(): void {
    // Dispose old meshes
    if (this.mainMesh) {
      this.mainMesh.geometry.dispose();
      (this.mainMesh.material as THREE.Material).dispose();
      this.remove(this.mainMesh);
      this.mainMesh = null;
    }
    if (this.outlineMesh) {
      this.outlineMesh.geometry.dispose();
      (this.outlineMesh.material as THREE.Material).dispose();
      this.remove(this.outlineMesh);
      this.outlineMesh = null;
    }
    if (this.labelSprite) {
      (this.labelSprite.material as THREE.SpriteMaterial).map?.dispose();
      this.labelSprite.material.dispose();
      this.remove(this.labelSprite);
      this.labelSprite = null;
    }
    if (this.contentSprite) {
      (this.contentSprite.material as THREE.SpriteMaterial).map?.dispose();
      this.contentSprite.material.dispose();
      this.remove(this.contentSprite);
      this.contentSprite = null;
    }

    this.build();

    if (this._isSelected) {
      this.updateSelectionVisual();
    }
  }

  public override dispose(): void {
    if (this.linkLine) {
      this.linkLine.geometry.dispose();
      (this.linkLine.material as THREE.Material).dispose();
    }
    if (this.labelSprite) {
      (this.labelSprite.material as THREE.SpriteMaterial).map?.dispose();
    }
    if (this.contentSprite) {
      (this.contentSprite.material as THREE.SpriteMaterial).map?.dispose();
    }
    super.dispose();
  }
}
