import * as THREE from 'three';

export interface SceneConfig {
  gridSize: number;
  gridDivisions: number;
  groundColor: number;
  backgroundColor: number;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
}

const DEFAULT_CONFIG: SceneConfig = {
  gridSize: 100,
  gridDivisions: 100,
  groundColor: 0x1a1a2e,
  backgroundColor: 0x0d0d1a,
  ambientLightIntensity: 0.6,
  directionalLightIntensity: 0.8,
};

export class Scene {
  public readonly scene: THREE.Scene;
  public readonly ground: THREE.Mesh;
  public readonly grid: THREE.GridHelper;
  private dropIndicator: THREE.Mesh | null = null;

  private config: SceneConfig;

  constructor(config: Partial<SceneConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.config.backgroundColor);

    this.setupLighting();
    this.ground = this.createGround();
    this.grid = this.createGrid();
    this.dropIndicator = this.createDropIndicator();

    this.scene.add(this.ground);
    this.scene.add(this.grid);
    this.scene.add(this.dropIndicator);
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, this.config.ambientLightIntensity);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, this.config.directionalLightIntensity);
    directional.position.set(50, 100, 50);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.near = 0.5;
    directional.shadow.camera.far = 500;
    directional.shadow.camera.left = -100;
    directional.shadow.camera.right = 100;
    directional.shadow.camera.top = 100;
    directional.shadow.camera.bottom = -100;
    this.scene.add(directional);

    const hemisphere = new THREE.HemisphereLight(0x606080, 0x404040, 0.3);
    this.scene.add(hemisphere);
  }

  private createGround(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(
      this.config.gridSize * 2,
      this.config.gridSize * 2
    );

    const material = new THREE.MeshStandardMaterial({
      color: this.config.groundColor,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    ground.name = 'ground';

    return ground;
  }

  private createGrid(): THREE.GridHelper {
    const grid = new THREE.GridHelper(
      this.config.gridSize,
      this.config.gridDivisions,
      0x3a3a5e,
      0x2a2a4e
    );
    grid.position.y = 0;
    return grid;
  }

  private createDropIndicator(): THREE.Mesh {
    const geometry = new THREE.RingGeometry(1.5, 2, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    
    const indicator = new THREE.Mesh(geometry, material);
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.y = 0.02;
    indicator.visible = false;
    indicator.name = 'dropIndicator';
    
    return indicator;
  }

  /**
   * Show drop indicator at world position
   */
  public showDropIndicator(x: number, z: number): void {
    if (this.dropIndicator) {
      this.dropIndicator.position.x = x;
      this.dropIndicator.position.z = z;
      this.dropIndicator.visible = true;
    }
  }

  /**
   * Hide drop indicator
   */
  public hideDropIndicator(): void {
    if (this.dropIndicator) {
      this.dropIndicator.visible = false;
    }
  }

  public setGridVisible(visible: boolean): void {
    this.grid.visible = visible;
  }

  public add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  public remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  public getObjectById(id: string): THREE.Object3D | undefined {
    return this.scene.getObjectByName(id) ?? undefined;
  }

  public raycastGround(
    raycaster: THREE.Raycaster
  ): THREE.Vector3 | null {
    const intersects = raycaster.intersectObject(this.ground);
    if (intersects.length > 0 && intersects[0]) {
      return intersects[0].point.clone();
    }
    return null;
  }

  public dispose(): void {
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    if (this.dropIndicator) {
      this.dropIndicator.geometry.dispose();
      (this.dropIndicator.material as THREE.Material).dispose();
    }
  }
}
