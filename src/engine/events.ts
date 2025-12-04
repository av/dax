import { EventEmitter } from 'eventemitter3';
import type { Vector3, DataObject, AgentState } from '@/types';

export interface DroppedFile {
  path: string;
  name: string;
}

export interface SceneEvents {
  'object:created': { object: DataObject };
  'object:updated': { id: string; changes: Partial<DataObject> };
  'object:deleted': { id: string };
  'object:moved': { id: string; position: Vector3; velocity: Vector3 };
  'object:hovered': { id: string | null; screenPosition: { x: number; y: number } | null };

  'selection:changed': { selected: string[]; added: string[]; removed: string[] };
  'selection:cleared': Record<string, never>;
  'selection:box:start': { start: { x: number; y: number } };
  'selection:box:update': { start: { x: number; y: number }; end: { x: number; y: number } };
  'selection:box:end': Record<string, never>;

  'camera:moved': { position: Vector3; target: Vector3; zoom: number };
  'camera:zoom': { level: number; focal: Vector3 };

  'input:click': {
    position: Vector3;
    screenPosition: { x: number; y: number };
    objectId?: string;
    button: 'left' | 'middle' | 'right';
    modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
  };
  'input:doubleclick': { objectId: string };
  'input:rightclick': { position: Vector3; objectId?: string };
  'input:drag:start': { objectIds: string[]; startPosition: Vector3 };
  'input:drag:move': { objectIds: string[]; currentPosition: Vector3; delta: Vector3 };
  'input:drag:end': { objectIds: string[]; finalPosition: Vector3 };
  'input:hover:enter': { objectId: string };
  'input:hover:leave': { objectId: string };
  'input:delete': { objectIds: string[] };

  'drop:files': { files: DroppedFile[]; position: Vector3 };
  'drop:hover': { position: Vector3; fileCount: number };
  'drop:cancel': Record<string, never>;

  'physics:collision': { objectA: string; objectB: string; impulse: number };
  'physics:settled': { objectIds: string[] };

  'agent:moved': { position: Vector3; state: AgentState };
  'agent:focus:start': { objectId: string };
  'agent:focus:end': { objectId: string };
  'agent:path:updated': { waypoints: Vector3[] };

  'boundary:entered': { boundaryId: string; objectIds: string[] };
  'boundary:exited': { boundaryId: string; objectIds: string[] };
  'beacon:range:entered': { beaconId: string; agentDistance: number };
  'beacon:range:exited': { beaconId: string };

  // Command events (UI → Scene)
  'command:select': { objectIds: string[]; mode: 'replace' | 'add' | 'toggle' };
  'command:delete': { objectIds: string[] };
  'command:move': { objectIds: string[]; delta: Vector3 };
  'command:focus': { objectId: string };
  'command:reset-camera': Record<string, never>;
  'command:toggle-grid': { visible: boolean };
  'command:toggle-physics': { enabled: boolean };
  'command:spawn-object': { type: string; position: Vector3; data: object };
  'command:agent:goto': { position: Vector3 };
  'command:agent:focus-object': { objectId: string };
  'command:agent:pause': Record<string, never>;
  'command:agent:resume': Record<string, never>;
  'command:agent:chat': { message: string; messageId: string };
  'command:toggle-chat': { open: boolean };
  'command:toggle-settings': { open: boolean };

  'file:saved': { path: string };
  'file:opened': { path: string; objectId: string };
  'file:closed': { path: string; objectId: string };

  'tool:changed': { mode: string };

  // Boundary drawing events
  'boundary:draw:start': Record<string, never>;
  'boundary:draw:vertex': { vertex: Vector3; vertices: Vector3[] };
  'boundary:draw:complete': { vertices: Vector3[] };
  'boundary:draw:cancel': Record<string, never>;
  'boundary:draw:preview': { vertices: Vector3[]; cursorPosition: Vector3 };

  // Boundary resize events
  'boundary:resize:start': { boundaryId: string; edgeIndex: number; position: Vector3 };
  'boundary:resize:move': { boundaryId: string; edgeIndex: number; newPosition: Vector3 };
  'boundary:resize:end': { boundaryId: string; newVertices: Vector3[] };
  'boundary:vertex:drag:start': { boundaryId: string; vertexIndex: number; position: Vector3 };
  'boundary:vertex:drag:move': { boundaryId: string; vertexIndex: number; newPosition: Vector3 };
  'boundary:vertex:drag:end': { boundaryId: string; newVertices: Vector3[] };

  // Beacon placement events
  'beacon:place:start': Record<string, never>;
  'beacon:place:preview': { position: Vector3 };
  'beacon:place:complete': { position: Vector3 };
  'beacon:place:cancel': Record<string, never>;

  'notification': { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string };

  'sandbox:sync': { modifications: number };
  
  'scene:ready': Record<string, never>;
  'scene:fps': { fps: number; frameTime: number };
  'scene:error': { error: string; recoverable: boolean };
}

export type SceneEventName = keyof SceneEvents;
export type SceneEventPayload<K extends SceneEventName> = SceneEvents[K];

class SceneEventBus extends EventEmitter<SceneEvents> {
  private static instance: SceneEventBus | null = null;

  private constructor() {
    super();
  }

  static getInstance(): SceneEventBus {
    if (!SceneEventBus.instance) {
      SceneEventBus.instance = new SceneEventBus();
    }
    return SceneEventBus.instance;
  }

  emitTyped<K extends SceneEventName>(event: K, payload: SceneEvents[K]): boolean {
    return this.emit(event, payload);
  }
}

export const sceneEvents = SceneEventBus.getInstance();
