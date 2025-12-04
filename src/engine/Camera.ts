import * as THREE from 'three';

export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  minZoom: number;
  maxZoom: number;
  panSpeed: number;
  rotateSpeed: number;
  zoomSpeed: number;
  keyboardPanSpeed: number;
  keyboardRotateSpeed: number;
  keyboardZoomSpeed: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

const DEFAULT_CONFIG: CameraConfig = {
  fov: 60,
  near: 0.1,
  far: 1000,
  minZoom: 0.2,
  maxZoom: 5,
  panSpeed: 50,
  rotateSpeed: 2,
  zoomSpeed: 0.1,
  keyboardPanSpeed: 30,
  keyboardRotateSpeed: 2,
  keyboardZoomSpeed: 0.5,
  minPolarAngle: 0.1,
  maxPolarAngle: Math.PI / 2 - 0.1,
};

export class Camera {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly target: THREE.Vector3;

  private config: CameraConfig;
  private spherical: THREE.Spherical;
  private isRotating: boolean = false;
  private isPanning: boolean = false;
  private lastMousePosition: THREE.Vector2 = new THREE.Vector2();
  private containerSize: THREE.Vector2 = new THREE.Vector2();
  private containerOffset: THREE.Vector2 = new THREE.Vector2();
  private panAnchorWorld: THREE.Vector3 | null = null;
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  constructor(aspect: number, config: Partial<CameraConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.camera = new THREE.PerspectiveCamera(
      this.config.fov,
      aspect,
      this.config.near,
      this.config.far
    );

    this.target = new THREE.Vector3(0, 0, 0);
    this.spherical = new THREE.Spherical(50, Math.PI / 4, 0);

    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const offset = new THREE.Vector3();
    offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  public setContainerSize(width: number, height: number): void {
    this.containerSize.set(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public setContainerOffset(left: number, top: number): void {
    this.containerOffset.set(left, top);
  }

  public onMouseDown(event: MouseEvent): void {
    this.lastMousePosition.set(event.clientX, event.clientY);

    if (event.button === 1) {
      this.isPanning = true;
      this.panAnchorWorld = this.screenToWorld(event.clientX, event.clientY);
    } else if (event.button === 2) {
      this.isRotating = true;
    }
  }

  public onMouseUp(_event: MouseEvent): void {
    this.isPanning = false;
    this.isRotating = false;
    this.panAnchorWorld = null;
  }

  public onMouseMove(event: MouseEvent, _deltaTime: number): void {
    const deltaX = event.clientX - this.lastMousePosition.x;
    const deltaY = event.clientY - this.lastMousePosition.y;
    this.lastMousePosition.set(event.clientX, event.clientY);

    if (this.isRotating) {
      this.rotate(deltaX, deltaY);
    } else if (this.isPanning && this.panAnchorWorld) {
      this.panToAnchor(event.clientX, event.clientY);
    }
  }

  public onWheel(event: WheelEvent): void {
    const delta = event.deltaY > 0 ? 1 : -1;
    this.zoom(delta);
  }

  public onKeyboardInput(keys: Set<string>, deltaTime: number): void {
    const right = new THREE.Vector3();
    right.setFromMatrixColumn(this.camera.matrix, 0);
    right.y = 0;
    right.normalize();

    const forward = new THREE.Vector3();
    forward.setFromMatrixColumn(this.camera.matrix, 2);
    forward.y = 0;
    forward.normalize();

    const panSpeed = this.config.keyboardPanSpeed * deltaTime;
    const panOffset = new THREE.Vector3();

    if (keys.has('w') || keys.has('W')) {
      panOffset.addScaledVector(forward, -panSpeed);
    }
    if (keys.has('s') || keys.has('S')) {
      panOffset.addScaledVector(forward, panSpeed);
    }
    if (keys.has('a') || keys.has('A')) {
      panOffset.addScaledVector(right, -panSpeed);
    }
    if (keys.has('d') || keys.has('D')) {
      panOffset.addScaledVector(right, panSpeed);
    }

    if (panOffset.lengthSq() > 0) {
      this.target.add(panOffset);
      this.updateCameraPosition();
    }

    if (keys.has('q') || keys.has('Q')) {
      this.spherical.theta += this.config.keyboardRotateSpeed * deltaTime;
      this.updateCameraPosition();
    }
    if (keys.has('e') || keys.has('E')) {
      this.spherical.theta -= this.config.keyboardRotateSpeed * deltaTime;
      this.updateCameraPosition();
    }

    if (keys.has('r') || keys.has('R')) {
      this.zoom(-this.config.keyboardZoomSpeed);
    }
    if (keys.has('f') || keys.has('F')) {
      this.zoom(this.config.keyboardZoomSpeed);
    }
  }

  private rotate(deltaX: number, deltaY: number): void {
    this.spherical.theta -= deltaX * this.config.rotateSpeed * 0.01;
    this.spherical.phi -= deltaY * this.config.rotateSpeed * 0.01;

    this.spherical.phi = Math.max(
      this.config.minPolarAngle,
      Math.min(this.config.maxPolarAngle, this.spherical.phi)
    );

    this.updateCameraPosition();
  }

  private screenToWorld(screenX: number, screenY: number): THREE.Vector3 | null {
    // Convert screen coordinates to NDC, accounting for container offset (FR-002)
    const localX = screenX - this.containerOffset.x;
    const localY = screenY - this.containerOffset.y;
    
    const ndc = new THREE.Vector2(
      (localX / this.containerSize.x) * 2 - 1,
      -(localY / this.containerSize.y) * 2 + 1
    );

    this.raycaster.setFromCamera(ndc, this.camera);
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
    return hit ? intersection : null;
  }

  private panToAnchor(screenX: number, screenY: number): void {
    const currentWorld = this.screenToWorld(screenX, screenY);
    if (!currentWorld || !this.panAnchorWorld) return;

    const delta = this.panAnchorWorld.clone().sub(currentWorld);
    this.target.add(delta);
    this.updateCameraPosition();
  }

  private zoom(delta: number): void {
    const zoomFactor = 1 + delta * this.config.zoomSpeed;
    this.spherical.radius = Math.max(
      this.spherical.radius / this.config.maxZoom,
      Math.min(
        this.spherical.radius / this.config.minZoom,
        this.spherical.radius * zoomFactor
      )
    );
    this.updateCameraPosition();
  }

  public setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.updateCameraPosition();
  }

  public setDistance(distance: number): void {
    this.spherical.radius = distance;
    this.updateCameraPosition();
  }

  public setAngles(phi: number, theta: number): void {
    this.spherical.phi = phi;
    this.spherical.theta = theta;
    this.updateCameraPosition();
  }

  public getState() {
    return {
      position: this.camera.position.clone(),
      target: this.target.clone(),
      zoom: 50 / this.spherical.radius,
      rotation: {
        x: this.spherical.phi,
        y: this.spherical.theta,
        z: 0,
      },
    };
  }
}
