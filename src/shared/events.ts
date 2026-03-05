export type FSEventType = 'add' | 'addDir' | 'unlink' | 'unlinkDir' | 'change';

/** Filesystem change event (from chokidar, normalized) */
export interface FSEvent {
  type: FSEventType;
  /** Relative path from workspace root */
  path: string;
  /** For rename detection: if this event is part of a rename pair */
  renameFrom?: string;
  timestamp: number;
}

/** Batched filesystem events after debounce window */
export interface FSEventBatch {
  events: FSEvent[];
  timestamp: number;
}

export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'learning' | 'paused';

export interface AgentEvent {
  type: 'status_change' | 'action_start' | 'action_complete' | 'speech' | 'error';
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface SceneEvent {
  type: 'object_added' | 'object_removed' | 'object_moved' | 'object_updated' | 'layout_complete';
  path: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}
