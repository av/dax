import * as THREE from 'three';
import { Scene } from './Scene';
import { Camera } from './Camera';
import { Physics, initRapier } from './Physics';
import { InputController } from './InputController';
import { ObjectManager } from './ObjectManager';
import { LODManager } from './LODManager';
import { sceneEvents } from './events';

export interface EngineConfig {
  targetFPS: number;
  physicsEnabled: boolean;
  lodEnabled: boolean;
}

const DEFAULT_CONFIG: EngineConfig = {
  targetFPS: 60,
  physicsEnabled: true,
  lodEnabled: true,
};

export class Engine {
  public readonly scene: Scene;
  public readonly camera: Camera;
  public physics: Physics | null = null;
  public lodManager: LODManager | null = null;
  public readonly inputController: InputController;
  public readonly renderer: THREE.WebGLRenderer;
  public objectManager: ObjectManager | null = null;

  private container: HTMLElement;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsAccumulator: number = 0;
  private isRunning: boolean = false;

  private constructor(
    container: HTMLElement,
    _config: Partial<EngineConfig> = {}
  ) {
    this.container = container;

    const rect = container.getBoundingClientRect();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new Scene();
    this.camera = new Camera(rect.width / rect.height);
    this.camera.setContainerSize(rect.width, rect.height);
    this.camera.setContainerOffset(rect.left, rect.top);

    this.inputController = new InputController(container);

    this.setupEventListeners();
  }

  public static async create(
    container: HTMLElement,
    config: Partial<EngineConfig> = {}
  ): Promise<Engine> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    if (finalConfig.physicsEnabled) {
      await initRapier();
    }

    const engine = new Engine(container, config);

    if (finalConfig.physicsEnabled) {
      engine.physics = new Physics();
    }

    // Create LOD manager if enabled
    if (finalConfig.lodEnabled) {
      engine.lodManager = new LODManager(engine.camera.camera);
    }

    // Create object manager
    engine.objectManager = new ObjectManager(engine.scene, engine.physics, {
      physicsEnabled: finalConfig.physicsEnabled,
    });

    // Connect input controller to object manager and camera
    engine.inputController.setObjectManager(engine.objectManager);
    engine.inputController.setCamera(engine.camera.camera);

    return engine;
  }

  private setupEventListeners(): void {
    const onResize = () => {
      const rect = this.container.getBoundingClientRect();
      this.renderer.setSize(rect.width, rect.height);
      this.camera.setContainerSize(rect.width, rect.height);
      this.camera.setContainerOffset(rect.left, rect.top);
    };

    window.addEventListener('resize', onResize);

    this.container.addEventListener('mousedown', (e) => {
      this.camera.onMouseDown(e);
    });

    this.container.addEventListener('mouseup', (e) => {
      this.camera.onMouseUp(e);
    });

    this.container.addEventListener('mousemove', (e) => {
      const deltaTime = 1 / 60;
      this.camera.onMouseMove(e, deltaTime);
    });

    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.onWheel(e);
    }, { passive: false });
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();

    sceneEvents.emit('scene:ready', {});
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.updateFPS(deltaTime);
  };

  private currentHoveredId: string | null = null;

  private update(deltaTime: number): void {
    this.camera.onKeyboardInput(this.inputController.getKeysDown(), deltaTime);

    if (this.physics) {
      const updates = this.physics.step(deltaTime);

      updates.forEach((update, id) => {
        const object = this.scene.getObjectById(id);
        if (object) {
          object.position.set(update.position.x, update.position.y, update.position.z);
        }

        sceneEvents.emit('object:moved', {
          id,
          position: update.position,
          velocity: update.velocity,
        });
      });
    }

    this.inputController.updateRaycaster(this.camera.camera);

    // Update LOD levels based on camera distance
    if (this.lodManager) {
      this.lodManager.update();
    }

    // Hover detection
    this.updateHover();
  }

  private updateHover(): void {
    if (!this.objectManager) return;

    const raycaster = this.inputController.getRaycaster();
    const hits = this.objectManager.raycastObjects(raycaster);

    const newHoveredId = hits.length > 0 && hits[0] ? hits[0].id : null;

    if (newHoveredId !== this.currentHoveredId) {
      this.currentHoveredId = newHoveredId;
      this.objectManager.setHovered(newHoveredId);

      sceneEvents.emit('object:hovered', {
        id: newHoveredId,
        screenPosition: this.getScreenPosition(newHoveredId),
      });
    }
  }

  private getScreenPosition(id: string | null): { x: number; y: number } | null {
    if (!id || !this.objectManager) return null;

    const object = this.objectManager.getObject(id);
    if (!object) return null;

    const worldPos = object.position.clone();
    worldPos.y += 1; // Offset above object

    const screenPos = worldPos.project(this.camera.camera);
    const rect = this.container.getBoundingClientRect();

    return {
      x: ((screenPos.x + 1) / 2) * rect.width,
      y: ((-screenPos.y + 1) / 2) * rect.height,
    };
  }

  private render(): void {
    this.renderer.render(this.scene.scene, this.camera.camera);
  }

  private updateFPS(deltaTime: number): void {
    this.frameCount++;
    this.fpsAccumulator += deltaTime;

    if (this.fpsAccumulator >= 1) {
      this.fps = this.frameCount / this.fpsAccumulator;
      sceneEvents.emit('scene:fps', {
        fps: this.fps,
        frameTime: 1000 / this.fps,
      });
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }
  }

  public getFPS(): number {
    return this.fps;
  }

  public dispose(): void {
    this.stop();
    this.inputController.detach();
    this.objectManager?.dispose();
    this.lodManager?.dispose();
    this.scene.dispose();
    this.physics?.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}

export { Scene } from './Scene';
export { Camera } from './Camera';
export { Physics, initRapier } from './Physics';
export { InputController } from './InputController';
export { ObjectManager } from './ObjectManager';
export { sceneEvents } from './events';
export { LODManager } from './LODManager';
