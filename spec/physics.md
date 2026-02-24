# Physics Engine — Spec

Replace the pre-computed Fermat spiral layout and manual lerp animations with a live physics simulation so workspace objects settle into position organically, respond to user interaction, and feel tangibly present in the world.

---

## Current architecture

`calculateLayout()` in `src/scene/layout/spatialLayout.ts` runs once per folder load and produces a static `Map<string, LayoutEntry>` of deterministic positions. Objects never move unless the user drags them. All animation is manual `lerp` or `Math.exp` decay inside `useFrame` callbacks — no physics engine exists in the project today.

The three object categories that need physics bodies:

| Object type | Current positioning | Current animation |
|---|---|---|
| File cards | Fermat spiral + seeded jitter; stored in `LayoutEntry.position` | Selection lift via `lifts[i] += (target - lifts[i]) * 0.12` per frame |
| Directory platforms | Recursive side-by-side placement, elevated `+4` per depth level | None — static |
| Agent entity | `store.moveTo()` sets `targetPosition`; `AgentEntity.tsx` lerps `group.position` | Exponential decay lerp, `1 - Math.exp(-2.5 * dt)` |

---

## Library choice: `@react-three/rapier`

Use [Rapier](https://rapier.rs/) via `@react-three/rapier`. It runs the physics world in a Web Worker (WASM), keeping the render thread free. It ships TypeScript types, integrates directly with R3F, and handles the instanced-mesh pattern needed for file cards.

```
npm install @react-three/rapier
```

No other physics library should be added.

---

## What changes

### 1. Physics world wrapper

Wrap the scene in `<Physics>` inside `Workspace.tsx`. Gravity should pull downward weakly (`[0, -4, 0]`) so objects that lose their constraint fall visibly but slowly. Set `timeStep="vary"` so the simulation tracks the render frame rate rather than running at a fixed tick.

```tsx
// src/scene/Workspace.tsx
import { Physics } from '@react-three/rapier';

// Inside <Canvas>:
<Physics gravity={[0, -4, 0]} timeStep="vary">
  {/* all scene children */}
</Physics>
```

### 2. Directory platforms — static rigid bodies

Each `DirectoryPlatform` gets a `<RigidBody type="fixed">`. The platform mesh becomes the collider geometry. Files that land on a platform sit on top of it and stay there; files dragged off the edge fall.

```tsx
// src/scene/DirectoryPlatform.tsx
import { RigidBody } from '@react-three/rapier';

<RigidBody type="fixed" colliders="cuboid">
  <mesh /* existing platform mesh */ />
</RigidBody>
```

The `platformSize` from `LayoutEntry` drives the cuboid half-extents: `[width/2, 0.1, depth/2]`.

### 3. File cards — dynamic rigid bodies with instanced colliders

This is the core change. File cards currently use a single `InstancedMesh` with matrices updated every frame. With Rapier, each file card needs its own `RigidBody`.

`@react-three/rapier` supports instanced rigid bodies via `<InstancedRigidBodies>`. Each instance maps to a physics body; the component syncs physics positions back to the `InstancedMesh` automatically.

```tsx
// src/scene/FileInstances.tsx
import { InstancedRigidBodies } from '@react-three/rapier';

// Build instances array from layoutMap:
const instances = files.map((file) => {
  const entry = layoutMap.get(file.id);
  return {
    key: file.id,
    position: entry?.position ?? [0, 1, 0],
    rotation: [0, entry?.rotationY ?? 0, 0],
  };
});

<InstancedRigidBodies
  instances={instances}
  ref={rigidBodyRef}
  colliders="cuboid"
  restitution={0.2}
  friction={0.8}
>
  <instancedMesh
    ref={meshRef}
    args={[CARD_GEOMETRY, material, files.length]}
  />
</InstancedRigidBodies>
```

The `calculateLayout()` result becomes the **spawn position**, not the final resting position. Objects are spawned above their target platform and fall under gravity, colliding with the platform surface and each other until they settle. This replaces the staggered `setInterval` entrance animation in `Workspace.tsx` — the stagger is now achieved by spawning files at intervals, each dropping into place.

#### Collider shape

The existing card is an `ExtrudeGeometry` dog-eared page shape (roughly `0.8 × 1.1 × 0.03` world units). Use a single `cuboid` collider scaled to the file's visual scale (`getFileScale(sizeBytes)`). This is cheaper than a convex hull and visually accurate enough given the shallow extrusion depth.

#### Drag integration

`FileDragger.tsx` currently writes to `positionOverrides` in `fileTreeStore`. With physics, dragging must also move the rigid body. When a drag begins, set the dragged body's type to `"kinematicPosition"` so physics stops controlling it; update its translation each frame from pointer world position; on drag end, restore type to `"dynamic"` and apply a small upward impulse so the card drops back naturally.

The `positionOverrides` Map in `fileTreeStore` stays as the persistence layer — on store rehydration, spawn bodies at their saved positions rather than layout-computed positions.

#### Selection lift

Remove the manual `lifts[i] += (target - lifts[i]) * 0.12` loop. Instead, apply a vertical impulse (`applyImpulse([0, 4, 0])`) to selected bodies when selection changes, and lock translation/rotation via constraints to prevent them drifting.

### 4. Agent entity — kinematic body

The agent is not a physics object in the environmental sense — it flies above the scene and should never be knocked around by falling cards. Give it a `type="kinematicPosition"` rigid body and keep the existing exponential decay lerp logic driving its translation each frame via `setNextKinematicTranslation`.

```tsx
// src/scene/AgentEntity.tsx
import { RigidBody } from '@react-three/rapier';

const agentRef = useRef<RapierRigidBody>(null);

useFrame((_, dt) => {
  // existing lerp math → target position
  agentRef.current?.setNextKinematicTranslation(lerpedPosition);
});

<RigidBody ref={agentRef} type="kinematicPosition" colliders={false}>
  {/* existing meshes */}
</RigidBody>
```

`colliders={false}` means the agent passes through file cards — intentional, since the agent flies through the workspace rather than landing on platforms.

---

## Data flow after this change

```
folder loaded
    → calculateLayout() produces spawn positions (unchanged)
    → positionOverrides merged on top (unchanged)
    → InstancedRigidBodies spawned at those positions, above their platform
    → Physics world runs: cards fall, bounce, settle
    → User drags card → kinematic override → released → dynamic again
    → positionOverrides written on release (for persistence across reload)
```

`calculateLayout()` itself does not change. It remains a pure function producing an organic starting distribution. Physics takes over from there.

---

## Files to touch

| File | Change |
|---|---|
| `package.json` | Add `@react-three/rapier` |
| `src/scene/Workspace.tsx` | Wrap scene in `<Physics>`; remove stagger `setInterval` |
| `src/scene/layout/spatialLayout.ts` | No change — output becomes spawn positions |
| `src/scene/FileInstances.tsx` | Replace `InstancedMesh` + manual matrix loop with `<InstancedRigidBodies>`; remove `lifts` lerp |
| `src/scene/FileDragger.tsx` | Switch dragged bodies to kinematic during drag; restore on release |
| `src/scene/DirectoryPlatform.tsx` | Wrap platform mesh in `<RigidBody type="fixed">` |
| `src/scene/AgentEntity.tsx` | Wrap in `<RigidBody type="kinematicPosition" colliders={false}>` |
| `src/stores/fileTreeStore.ts` | No change — `positionOverrides` persistence unchanged |

---

## Things to be careful about

**Performance.** Rapier in a Web Worker is fast, but hundreds of dynamic bodies is the threshold where it starts mattering. The existing LOD system hides distant cards behind billboard points — those cards should have their physics bodies set to `"fixed"` or removed from simulation entirely when they drop below the LOD threshold. Reintroduce them as dynamic bodies when the camera approaches.

**Instanced body API stability.** `InstancedRigidBodies` is newer surface area in `@react-three/rapier`. Verify the version supports per-instance impulse application before committing to it.

**Sleeping bodies.** Rapier automatically puts settled bodies to sleep. This is desirable — sleeping bodies don't cost CPU. Don't fight it. Only wake bodies when the user interacts with them or a file change event repositions them.

**File change events.** When `fileTreeStore` receives a `fs:fileChange` event adding a new file, spawn a new dynamic body at the layout position for that file. When a file is removed, destroy its body immediately.

**Restitution tuning.** Cards should feel like paper landing on a desk, not rubber balls. Set `restitution` low (0.1–0.2) and `friction` high (0.7–0.9). Tweak in dev with the Rapier debug renderer (`<Debug />` component) enabled.
