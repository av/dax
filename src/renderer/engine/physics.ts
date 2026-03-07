/**
 * Physics engine — Havok WASM initialization and body management.
 *
 * - Initializes Havok physics plugin (WASM)
 * - Creates physics bodies for meshes (dynamic for files, static/kinematic for folders)
 * - Creates static ground body and invisible boundary walls
 * - Physics timestep fixed at 60Hz, decoupled from render framerate
 * - Bodies deactivate (sleep) after settling
 */
import HavokPhysics from '@babylonjs/havok';
import {
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType,
  PhysicsMotionType,
  Vector3,
  MeshBuilder,
  type Scene,
  type Mesh,
  type TransformNode,
  type AbstractMesh,
} from '@babylonjs/core';
import {
  PHYSICS_GRAVITY,
  PHYSICS_DEFAULT_RESTITUTION,
  PHYSICS_DEFAULT_FRICTION,
  PHYSICS_LINEAR_DAMPING,
  PHYSICS_ANGULAR_DAMPING,
  GROUND_SIZE,
  BOUNDARY_WALL_HEIGHT,
  BOUNDARY_WALL_THICKNESS,
} from '@shared/constants';

let havokPlugin: HavokPlugin | null = null;

/** Map of mesh name → PhysicsAggregate for later access/disposal */
const aggregateMap = new Map<string, PhysicsAggregate>();

/**
 * Initialize Havok physics plugin (WASM) and enable physics on the scene.
 * Must be called before creating any physics bodies.
 */
export async function initPhysics(scene: Scene): Promise<HavokPlugin> {
  // Fetch the WASM binary explicitly to avoid Vite MIME type / 404 issues.
  // The file is copied to public/ by the copy-havok-wasm Vite plugin and
  // served at the root URL in both dev (Vite dev server) and production
  // (Electron loadFile from build output).
  const wasmBinary = await fetch('./HavokPhysics.wasm').then((r) => {
    if (!r.ok) throw new Error(`Failed to fetch HavokPhysics.wasm: ${r.status}`);
    return r.arrayBuffer();
  });

  const havokInstance = await HavokPhysics({ wasmBinary });
  havokPlugin = new HavokPlugin(true, havokInstance);

  scene.enablePhysics(new Vector3(0, PHYSICS_GRAVITY, 0), havokPlugin);

  // Set fixed timestep for deterministic physics
  // Havok plugin handles sub-stepping internally at 60Hz
  if (havokPlugin.setTimeStep) {
    havokPlugin.setTimeStep(1 / 60);
  }

  return havokPlugin;
}

/**
 * Get the currently active Havok plugin instance.
 */
export function getPhysicsPlugin(): HavokPlugin | null {
  return havokPlugin;
}

/**
 * Create a static physics body for the ground plane.
 * mass=0 makes it immovable.
 */
export function createGroundBody(ground: Mesh, scene: Scene): PhysicsAggregate {
  const aggregate = new PhysicsAggregate(
    ground,
    PhysicsShapeType.BOX,
    {
      mass: 0,
      restitution: PHYSICS_DEFAULT_RESTITUTION,
      friction: PHYSICS_DEFAULT_FRICTION,
    },
    scene,
  );

  aggregateMap.set(ground.name, aggregate);
  return aggregate;
}

/**
 * Create invisible boundary walls around the scene to prevent objects from falling off.
 * Four walls at the edges of the ground plane.
 */
export function createBoundaryWalls(scene: Scene): void {
  const halfGround = GROUND_SIZE / 2;
  const wallY = BOUNDARY_WALL_HEIGHT / 2;

  const wallDefs = [
    // North wall (positive Z)
    {
      name: 'boundary_north',
      width: GROUND_SIZE,
      height: BOUNDARY_WALL_HEIGHT,
      depth: BOUNDARY_WALL_THICKNESS,
      x: 0,
      y: wallY,
      z: halfGround,
    },
    // South wall (negative Z)
    {
      name: 'boundary_south',
      width: GROUND_SIZE,
      height: BOUNDARY_WALL_HEIGHT,
      depth: BOUNDARY_WALL_THICKNESS,
      x: 0,
      y: wallY,
      z: -halfGround,
    },
    // East wall (positive X)
    {
      name: 'boundary_east',
      width: BOUNDARY_WALL_THICKNESS,
      height: BOUNDARY_WALL_HEIGHT,
      depth: GROUND_SIZE,
      x: halfGround,
      y: wallY,
      z: 0,
    },
    // West wall (negative X)
    {
      name: 'boundary_west',
      width: BOUNDARY_WALL_THICKNESS,
      height: BOUNDARY_WALL_HEIGHT,
      depth: GROUND_SIZE,
      x: -halfGround,
      y: wallY,
      z: 0,
    },
  ];

  for (const def of wallDefs) {
    const wall = MeshBuilder.CreateBox(
      def.name,
      { width: def.width, height: def.height, depth: def.depth },
      scene,
    );
    wall.position.set(def.x, def.y, def.z);
    wall.isVisible = false; // Invisible walls
    wall.isPickable = false;

    const aggregate = new PhysicsAggregate(
      wall,
      PhysicsShapeType.BOX,
      {
        mass: 0,
        restitution: PHYSICS_DEFAULT_RESTITUTION,
        friction: PHYSICS_DEFAULT_FRICTION,
      },
      scene,
    );

    aggregateMap.set(def.name, aggregate);
  }
}

/**
 * Add a physics body to a file mesh.
 * Created as kinematic (ANIMATED) by default so layout positioning is not
 * fought by the physics engine. Switch to DYNAMIC only when the user grabs
 * and throws the object.
 */
export function addFilePhysicsBody(
  mesh: AbstractMesh,
  scene: Scene,
): PhysicsAggregate {
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    {
      mass: 1,
      restitution: PHYSICS_DEFAULT_RESTITUTION,
      friction: PHYSICS_DEFAULT_FRICTION,
    },
    scene,
  );

  // Apply damping so objects settle faster when thrown
  if (aggregate.body) {
    aggregate.body.setLinearDamping(PHYSICS_LINEAR_DAMPING);
    aggregate.body.setAngularDamping(PHYSICS_ANGULAR_DAMPING);
    // Start as kinematic — layout positions the object, not physics
    aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
  }

  aggregateMap.set(mesh.name, aggregate);
  return aggregate;
}

/**
 * Switch a file physics body to kinematic mode (layout-controlled).
 */
export function setBodyKinematic(meshName: string): void {
  const agg = aggregateMap.get(meshName);
  if (agg?.body) {
    agg.body.setMotionType(PhysicsMotionType.ANIMATED);
    agg.body.setLinearVelocity(Vector3.Zero());
    agg.body.setAngularVelocity(Vector3.Zero());
  }
}

/**
 * Switch a file physics body to dynamic mode (physics-controlled).
 */
export function setBodyDynamic(meshName: string): void {
  const agg = aggregateMap.get(meshName);
  if (agg?.body) {
    agg.body.setMotionType(PhysicsMotionType.DYNAMIC);
  }
}

/**
 * Add a static/kinematic physics body to a folder container.
 * Folders don't fall — they stay in place.
 */
export function addFolderPhysicsBody(
  mesh: AbstractMesh,
  scene: Scene,
): PhysicsAggregate {
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    {
      mass: 0,
      restitution: PHYSICS_DEFAULT_RESTITUTION,
      friction: PHYSICS_DEFAULT_FRICTION,
    },
    scene,
  );

  // Set motion type to ANIMATED (kinematic) so it can be moved programmatically
  // but doesn't fall under gravity
  if (aggregate.body) {
    aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
  }

  aggregateMap.set(mesh.name, aggregate);
  return aggregate;
}

/**
 * Get the physics aggregate for a mesh.
 */
export function getAggregate(meshName: string): PhysicsAggregate | undefined {
  return aggregateMap.get(meshName);
}

/**
 * Remove and dispose a physics aggregate by mesh name.
 */
export function disposeAggregate(meshName: string): void {
  const agg = aggregateMap.get(meshName);
  if (agg) {
    agg.dispose();
    aggregateMap.delete(meshName);
  }
}

/**
 * Cleanup all physics — dispose all aggregates and plugin.
 */
export function disposePhysics(): void {
  for (const [, agg] of aggregateMap) {
    agg.dispose();
  }
  aggregateMap.clear();
  havokPlugin = null;
}
