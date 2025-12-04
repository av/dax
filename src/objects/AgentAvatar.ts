import * as THREE from 'three';
import type { Agent, AgentState, Vector3 } from '@/types';

export interface AgentAvatarConfig {
  bodyColor?: number;
  glowColor?: number;
  size?: number;
  animationSpeed?: number;
}

const DEFAULT_CONFIG: AgentAvatarConfig = {
  bodyColor: 0x4a9eff,
  glowColor: 0x00ff88,
  size: 0.8,
  animationSpeed: 1,
};

// State colors for visual feedback
const STATE_COLORS: Record<AgentState, number> = {
  idle: 0x4a9eff,       // Blue
  moving: 0x00ff88,     // Green
  analyzing: 0xff00ff,  // Magenta
  thinking: 0xffff00,   // Yellow
  executing: 0xff8800,  // Orange
  waiting: 0x888888,    // Gray
  paused: 0x444444,     // Dark gray
};

/**
 * 3D representation of the AI agent on the data plane
 */
export class AgentAvatar extends THREE.Group {
  public readonly agentId: string;
  private config: AgentAvatarConfig;
  
  private bodyMesh: THREE.Mesh | null = null;
  private coreMesh: THREE.Mesh | null = null;
  private glowMesh: THREE.Mesh | null = null;
  private eyeMesh: THREE.Mesh | null = null;
  private ringMesh: THREE.Mesh | null = null;
  private pathLine: THREE.Line | null = null;
  
  private currentState: AgentState = 'idle';
  private animationTime: number = 0;
  private targetPosition: Vector3 | null = null;
  private movementSpeed: number = 3; // Units per second
  private focusedObjectId: string | null = null;
  
  // Animation parameters
  private bobAmplitude: number = 0.1;
  private bobFrequency: number = 2;
  private rotationSpeed: number = 0.5;
  private pulseFrequency: number = 1.5;

  constructor(agent: Agent, config: Partial<AgentAvatarConfig> = {}) {
    super();
    
    this.agentId = agent.id;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentState = agent.state;
    
    this.name = `agent-${agent.id}`;
    this.userData.isAgent = true;
    this.userData.agentId = agent.id;
    
    this.position.set(agent.position.x, agent.position.y, agent.position.z);
    
    this.build();
  }

  private build(): void {
    const size = this.config.size ?? 0.8;
    
    // Create main body (octahedron shape for a gem-like appearance)
    const bodyGeometry = new THREE.OctahedronGeometry(size * 0.5, 1);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.config.bodyColor,
      roughness: 0.3,
      metalness: 0.7,
      emissive: this.config.bodyColor,
      emissiveIntensity: 0.2,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.add(this.bodyMesh);
    
    // Create glowing core inside
    const coreGeometry = new THREE.IcosahedronGeometry(size * 0.25, 1);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    this.coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    this.add(this.coreMesh);
    
    // Create outer glow effect
    const glowGeometry = new THREE.SphereGeometry(size * 0.7, 16, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: this.config.glowColor,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
    });
    this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.add(this.glowMesh);
    
    // Create eye/focus indicator
    const eyeGeometry = new THREE.SphereGeometry(size * 0.12, 16, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    this.eyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
    this.eyeMesh.position.set(0, size * 0.15, size * 0.35);
    this.add(this.eyeMesh);
    
    // Create rotating ring (for activity indication)
    const ringGeometry = new THREE.TorusGeometry(size * 0.6, size * 0.03, 8, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: this.config.glowColor,
      transparent: true,
      opacity: 0.5,
    });
    this.ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.ringMesh.visible = false; // Only visible when active
    this.add(this.ringMesh);
    
    // Create path visualization line
    const pathGeometry = new THREE.BufferGeometry();
    const pathMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.5,
      linewidth: 2,
    });
    this.pathLine = new THREE.Line(pathGeometry, pathMaterial);
    this.pathLine.visible = false;
    this.add(this.pathLine);
  }

  /**
   * Update the agent's state and visuals
   */
  public updateState(state: AgentState): void {
    if (this.currentState === state) return;
    
    this.currentState = state;
    this.updateStateVisuals();
  }

  private updateStateVisuals(): void {
    if (!this.bodyMesh || !this.ringMesh) return;
    
    const material = this.bodyMesh.material as THREE.MeshStandardMaterial;
    const stateColor = STATE_COLORS[this.currentState];
    
    material.color.setHex(stateColor);
    material.emissive.setHex(stateColor);
    
    // Show/hide activity ring based on state
    const isActive = ['moving', 'analyzing', 'thinking', 'executing'].includes(this.currentState);
    this.ringMesh.visible = isActive;
    
    // Adjust glow based on state
    if (this.glowMesh) {
      const glowMaterial = this.glowMesh.material as THREE.MeshBasicMaterial;
      glowMaterial.color.setHex(stateColor);
      glowMaterial.opacity = isActive ? 0.15 : 0.08;
    }
    
    // Pause visual for paused state
    if (this.currentState === 'paused') {
      material.emissiveIntensity = 0.1;
    } else {
      material.emissiveIntensity = 0.3;
    }
  }

  /**
   * Set the agent's target position for movement
   */
  public setTargetPosition(target: Vector3 | null): void {
    this.targetPosition = target;
  }

  /**
   * Set movement speed
   */
  public setMovementSpeed(speed: number): void {
    this.movementSpeed = speed;
  }

  /**
   * Set the object the agent is focusing on
   */
  public setFocusedObject(objectId: string | null, objectPosition?: Vector3): void {
    this.focusedObjectId = objectId;
    
    // Make eye look toward focused object
    if (this.eyeMesh && objectPosition) {
      const direction = new THREE.Vector3(
        objectPosition.x - this.position.x,
        0,
        objectPosition.z - this.position.z
      ).normalize();
      
      this.eyeMesh.position.set(
        direction.x * 0.3,
        0.1,
        direction.z * 0.3
      );
    }
  }

  /**
   * Update path visualization
   */
  public updatePath(waypoints: Vector3[]): void {
    if (!this.pathLine) return;
    
    if (waypoints.length < 2) {
      this.pathLine.visible = false;
      return;
    }
    
    const positions = new Float32Array(waypoints.length * 3);
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (!wp) continue;
      // Convert to local space
      positions[i * 3] = wp.x - this.position.x;
      positions[i * 3 + 1] = wp.y - this.position.y + 0.1; // Slightly above ground
      positions[i * 3 + 2] = wp.z - this.position.z;
    }
    
    this.pathLine.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    this.pathLine.geometry.computeBoundingSphere();
    this.pathLine.visible = true;
  }

  /**
   * Hide path visualization
   */
  public hidePath(): void {
    if (this.pathLine) {
      this.pathLine.visible = false;
    }
  }

  /**
   * Update animation frame
   */
  public update(deltaTime: number): boolean {
    this.animationTime += deltaTime * (this.config.animationSpeed ?? 1);
    
    this.updateIdleAnimation();
    this.updateStateAnimation();
    
    // Return true if still moving
    return this.updateMovement(deltaTime);
  }

  private updateIdleAnimation(): void {
    // Bobbing motion
    const bobOffset = Math.sin(this.animationTime * this.bobFrequency * Math.PI * 2) * this.bobAmplitude;
    
    if (this.bodyMesh) {
      this.bodyMesh.position.y = bobOffset;
    }
    if (this.coreMesh) {
      this.coreMesh.position.y = bobOffset;
    }
    if (this.glowMesh) {
      this.glowMesh.position.y = bobOffset;
    }
    if (this.eyeMesh) {
      this.eyeMesh.position.y = 0.1 + bobOffset;
    }
    
    // Core pulsing
    if (this.coreMesh) {
      const pulse = 0.9 + Math.sin(this.animationTime * this.pulseFrequency * Math.PI * 2) * 0.1;
      this.coreMesh.scale.setScalar(pulse);
    }
  }

  private updateStateAnimation(): void {
    // Rotate ring when active
    if (this.ringMesh && this.ringMesh.visible) {
      this.ringMesh.rotation.z += this.rotationSpeed * 0.016; // Assuming 60 FPS
    }
    
    // Spin body slightly when thinking
    if (this.currentState === 'thinking' && this.bodyMesh) {
      this.bodyMesh.rotation.y += 0.02;
    }
    
    // More intense pulsing when analyzing
    if (this.currentState === 'analyzing' && this.glowMesh) {
      const intensity = 0.1 + Math.sin(this.animationTime * 4) * 0.1;
      (this.glowMesh.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
  }

  private updateMovement(deltaTime: number): boolean {
    if (!this.targetPosition || this.currentState === 'paused') {
      return false;
    }
    
    const targetVec = new THREE.Vector3(
      this.targetPosition.x,
      this.targetPosition.y,
      this.targetPosition.z
    );
    
    const distance = this.position.distanceTo(targetVec);
    const arrivalThreshold = 0.5;
    
    if (distance < arrivalThreshold) {
      this.position.copy(targetVec);
      return false; // Arrived
    }
    
    // Move toward target
    const direction = targetVec.clone().sub(this.position).normalize();
    const moveDistance = Math.min(this.movementSpeed * deltaTime, distance);
    
    this.position.add(direction.multiplyScalar(moveDistance));
    
    // Rotate to face movement direction
    if (this.bodyMesh) {
      const targetAngle = Math.atan2(direction.x, direction.z);
      const currentAngle = this.bodyMesh.rotation.y;
      const angleDiff = targetAngle - currentAngle;
      
      // Smooth rotation
      this.bodyMesh.rotation.y += angleDiff * 0.1;
    }
    
    return true; // Still moving
  }

  /**
   * Get current position as Vector3
   */
  public getPosition(): Vector3 {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    };
  }

  /**
   * Set position directly
   */
  public setPosition(position: Vector3): void {
    this.position.set(position.x, position.y, position.z);
  }

  /**
   * Get the current state
   */
  public getState(): AgentState {
    return this.currentState;
  }

  /**
   * Get focused object ID
   */
  public getFocusedObjectId(): string | null {
    return this.focusedObjectId;
  }

  /**
   * Check if agent has arrived at target
   */
  public hasArrivedAtTarget(): boolean {
    if (!this.targetPosition) return true;
    
    const distance = new THREE.Vector3(
      this.targetPosition.x - this.position.x,
      this.targetPosition.y - this.position.y,
      this.targetPosition.z - this.position.z
    ).length();
    
    return distance < 0.5;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
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
  }
}
