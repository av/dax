import RAPIER from '@dimforge/rapier3d-compat';
import type { Vector3 } from '@/types';

let rapierReady = false;
let rapierInitPromise: Promise<void> | null = null;

export async function initRapier(): Promise<void> {
  if (rapierReady) return;
  if (rapierInitPromise) return rapierInitPromise;

  rapierInitPromise = RAPIER.init().then(() => {
    rapierReady = true;
  });

  return rapierInitPromise;
}

export interface PhysicsConfig {
  gravity: Vector3;
  timestep: number;
}

const DEFAULT_CONFIG: PhysicsConfig = {
  gravity: { x: 0, y: -9.81, z: 0 },
  timestep: 1 / 60,
};

export class Physics {
  private world: RAPIER.World;
  private config: PhysicsConfig;
  private bodies: Map<string, RAPIER.RigidBody> = new Map();
  private colliders: Map<string, RAPIER.Collider> = new Map();
  private accumulator: number = 0;

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const gravity = new RAPIER.Vector3(
      this.config.gravity.x,
      this.config.gravity.y,
      this.config.gravity.z
    );
    this.world = new RAPIER.World(gravity);

    this.createGround();
  }

  private createGround(): void {
    const groundBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)
    );

    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(100, 0.5, 100);
    this.world.createCollider(groundColliderDesc, groundBody);
  }

  public createBody(
    id: string,
    position: Vector3,
    size: Vector3,
    isStatic: boolean = false
  ): RAPIER.RigidBody {
    const bodyDesc = isStatic
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(position.x, position.y, position.z)
          .setLinearDamping(0.5)
          .setAngularDamping(0.5);

    const body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    )
      .setRestitution(0.2)
      .setFriction(0.8);

    const collider = this.world.createCollider(colliderDesc, body);

    this.bodies.set(id, body);
    this.colliders.set(id, collider);

    return body;
  }

  public removeBody(id: string): void {
    const body = this.bodies.get(id);
    if (body) {
      this.world.removeRigidBody(body);
      this.bodies.delete(id);
      this.colliders.delete(id);
    }
  }

  public getBody(id: string): RAPIER.RigidBody | undefined {
    return this.bodies.get(id);
  }

  public setBodyPosition(id: string, position: Vector3): void {
    const body = this.bodies.get(id);
    if (body) {
      body.setTranslation(new RAPIER.Vector3(position.x, position.y, position.z), true);
    }
  }

  public applyImpulse(id: string, impulse: Vector3): void {
    const body = this.bodies.get(id);
    if (body) {
      body.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);
    }
  }

  public wakeBody(id: string): void {
    const body = this.bodies.get(id);
    if (body) {
      body.wakeUp();
    }
  }

  public setBodyKinematic(id: string, isKinematic: boolean): void {
    const body = this.bodies.get(id);
    if (body) {
      if (isKinematic) {
        body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      } else {
        body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      }
    }
  }

  public step(deltaTime: number): Map<string, { position: Vector3; velocity: Vector3 }> {
    this.accumulator += deltaTime;

    while (this.accumulator >= this.config.timestep) {
      this.world.step();
      this.accumulator -= this.config.timestep;
    }

    const updates = new Map<string, { position: Vector3; velocity: Vector3 }>();

    this.bodies.forEach((body, id) => {
      if (!body.isSleeping()) {
        const pos = body.translation();
        const vel = body.linvel();
        updates.set(id, {
          position: { x: pos.x, y: pos.y, z: pos.z },
          velocity: { x: vel.x, y: vel.y, z: vel.z },
        });
      }
    });

    return updates;
  }

  public getSettledBodies(): string[] {
    const settled: string[] = [];
    this.bodies.forEach((body, id) => {
      if (body.isSleeping()) {
        settled.push(id);
      }
    });
    return settled;
  }

  public dispose(): void {
    this.world.free();
    this.bodies.clear();
    this.colliders.clear();
  }
}
