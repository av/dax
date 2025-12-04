# Scene Events Contract

**Feature**: 001-dax-core | **Date**: 2024-12-04

## Overview

The 3D engine communicates with UI components and state stores through a typed event system. Events flow bidirectionally between the Three.js scene and React components.

## Event Bus Architecture

```typescript
import { EventEmitter } from 'eventemitter3';

interface SceneEvents {
  // Object lifecycle
  'object:created': { object: DataObject };
  'object:updated': { id: string; changes: Partial<DataObject> };
  'object:deleted': { id: string };
  'object:moved': { id: string; position: Vector3; velocity: Vector3 };

  // Selection
  'selection:changed': { selected: string[]; added: string[]; removed: string[] };
  'selection:cleared': {};

  // Camera
  'camera:moved': { position: Vector3; target: Vector3; zoom: number };
  'camera:zoom': { level: number; focal: Vector3 };

  // Input
  'input:click': { position: Vector3; screenPosition: { x: number; y: number }; objectId?: string };
  'input:doubleclick': { objectId: string };
  'input:rightclick': { position: Vector3; objectId?: string };
  'input:drag:start': { objectIds: string[]; startPosition: Vector3 };
  'input:drag:move': { objectIds: string[]; currentPosition: Vector3; delta: Vector3 };
  'input:drag:end': { objectIds: string[]; finalPosition: Vector3 };
  'input:hover:enter': { objectId: string };
  'input:hover:leave': { objectId: string };

  // Drag & Drop (external files)
  'drop:files': { files: DroppedFile[]; position: Vector3 };
  'drop:hover': { position: Vector3; fileCount: number };
  'drop:cancel': {};

  // Physics
  'physics:collision': { objectA: string; objectB: string; impulse: number };
  'physics:settled': { objectIds: string[] };

  // Agent
  'agent:moved': { position: Vector3; state: AgentState };
  'agent:focus:start': { objectId: string };
  'agent:focus:end': { objectId: string };
  'agent:path:updated': { waypoints: Vector3[] };

  // Boundary/Beacon
  'boundary:entered': { boundaryId: string; objectIds: string[] };
  'boundary:exited': { boundaryId: string; objectIds: string[] };
  'beacon:range:entered': { beaconId: string; agentDistance: number };
  'beacon:range:exited': { beaconId: string };

  // Scene state
  'scene:ready': {};
  'scene:fps': { fps: number; frameTime: number };
  'scene:error': { error: string; recoverable: boolean };
}

type SceneEventBus = EventEmitter<SceneEvents>;
```

---

## Object Events

### `object:created`

Fired when a new object is added to the scene.

```typescript
interface ObjectCreatedEvent {
  object: DataObject;  // full object data
}

// Example: File dropped onto plane
sceneEvents.emit('object:created', {
  object: {
    id: 'file-abc123',
    type: 'file',
    position: { x: 10, y: 0, z: -5 },
    // ... rest of FileObject
  }
});
```

### `object:moved`

Fired during physics simulation when object position changes significantly.

```typescript
interface ObjectMovedEvent {
  id: string;
  position: Vector3;
  velocity: Vector3;  // for interpolation
}

// Batched for performance - fires at most once per frame per object
```

### `object:updated`

Fired when object properties change (not position - that's `object:moved`).

```typescript
interface ObjectUpdatedEvent {
  id: string;
  changes: Partial<DataObject>;  // only changed fields
}

// Example: File edited
sceneEvents.emit('object:updated', {
  id: 'file-abc123',
  changes: { updatedAt: Date.now() }
});
```

---

## Selection Events

### `selection:changed`

Comprehensive selection change event.

```typescript
interface SelectionChangedEvent {
  selected: string[];   // all currently selected IDs
  added: string[];      // newly selected this event
  removed: string[];    // deselected this event
}

// Example: User shift-clicks to add to selection
sceneEvents.emit('selection:changed', {
  selected: ['file-1', 'file-2', 'file-3'],
  added: ['file-3'],
  removed: []
});
```

---

## Camera Events

### `camera:moved`

Fired when camera position or target changes (throttled to 30Hz max).

```typescript
interface CameraMoved {
  position: Vector3;    // camera world position
  target: Vector3;      // look-at point
  zoom: number;         // zoom level (1 = default)
  rotation: Vector3;    // euler angles
}
```

### `camera:zoom`

Specific zoom event for UI feedback.

```typescript
interface CameraZoom {
  level: number;        // 0.1 to 10 (1 = default)
  focal: Vector3;       // zoom focal point
}
```

---

## Input Events

### `input:click`

Single click on scene (after distinguishing from drag).

```typescript
interface InputClick {
  position: Vector3;           // world position on plane
  screenPosition: { x: number; y: number };  // screen coords
  objectId?: string;           // clicked object (if any)
  button: 'left' | 'middle' | 'right';
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
  };
}
```

### `input:doubleclick`

Double-click on object (triggers open/edit).

```typescript
interface InputDoubleClick {
  objectId: string;  // always on an object
}

// Handler opens editor for file, inline edit for snippet, etc.
```

### `input:drag:*`

Drag sequence for moving objects.

```typescript
interface DragStart {
  objectIds: string[];     // objects being dragged
  startPosition: Vector3;  // initial world position
}

interface DragMove {
  objectIds: string[];
  currentPosition: Vector3;
  delta: Vector3;          // movement since last event
}

interface DragEnd {
  objectIds: string[];
  finalPosition: Vector3;  // where objects were dropped
  cancelled: boolean;      // true if drag was cancelled (Escape)
}
```

---

## Drop Events (External Files)

### `drop:files`

Files dropped from OS file manager.

```typescript
interface DroppedFile {
  path: string;
  name: string;
  size: number;
  type: string;  // MIME type if available
}

interface DropFiles {
  files: DroppedFile[];
  position: Vector3;  // world position of drop
}
```

### `drop:hover`

File being dragged over the scene (for visual feedback).

```typescript
interface DropHover {
  position: Vector3;
  fileCount: number;
}
```

---

## Physics Events

### `physics:collision`

Objects collided.

```typescript
interface PhysicsCollision {
  objectA: string;
  objectB: string;
  impulse: number;    // collision strength
  contactPoint: Vector3;
}
```

### `physics:settled`

Objects have come to rest.

```typescript
interface PhysicsSettled {
  objectIds: string[];  // objects that just settled
}

// Used to optimize physics (sleep settled objects)
```

---

## Agent Events

### `agent:moved`

Agent position updated.

```typescript
interface AgentMoved {
  position: Vector3;
  state: AgentState;
  velocity?: Vector3;
}
```

### `agent:focus:start`

Agent began analyzing an object.

```typescript
interface AgentFocusStart {
  objectId: string;
  estimatedDuration?: number;  // ms, if known
}
```

### `agent:path:updated`

Agent's planned path changed.

```typescript
interface AgentPathUpdated {
  waypoints: Vector3[];  // path from current to destination
}

// Used to render path visualization
```

---

## Zone Events

### `boundary:entered`

Objects moved into a boundary zone.

```typescript
interface BoundaryEntered {
  boundaryId: string;
  objectIds: string[];  // objects that entered
}
```

### `beacon:range:entered`

Agent entered beacon influence radius.

```typescript
interface BeaconRangeEntered {
  beaconId: string;
  agentDistance: number;  // distance from beacon center
  intensity: number;      // calculated influence (0-1)
}
```

---

## Scene State Events

### `scene:ready`

Scene initialized and ready for interaction.

```typescript
// No payload - indicates scene is fully loaded and interactive
sceneEvents.emit('scene:ready');
```

### `scene:fps`

Performance metrics (throttled to 1Hz).

```typescript
interface SceneFPS {
  fps: number;          // frames per second
  frameTime: number;    // average frame time in ms
  objectCount: number;  // total scene objects
  physicsTime: number;  // physics step time in ms
}
```

---

## Command Events (UI → Scene)

Events sent from UI to control the scene.

```typescript
interface SceneCommands {
  'command:select': { objectIds: string[]; mode: 'replace' | 'add' | 'toggle' };
  'command:delete': { objectIds: string[] };
  'command:move': { objectIds: string[]; delta: Vector3 };
  'command:focus': { objectId: string };  // camera focus on object
  'command:reset-camera': {};
  'command:toggle-grid': { visible: boolean };
  'command:toggle-physics': { enabled: boolean };
  'command:spawn-object': { type: DataObjectType; position: Vector3; data: object };
  'command:agent:goto': { position: Vector3 };
  'command:agent:focus-object': { objectId: string };
  'command:agent:pause': {};
  'command:agent:resume': {};
}
```
