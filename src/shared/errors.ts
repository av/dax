export type DaxErrorCode =
  // Filesystem
  | 'FS_NOT_FOUND'
  | 'FS_PERMISSION'
  | 'FS_DISK_FULL'
  | 'FS_NAME_TOO_LONG'
  | 'FS_FILE_IN_USE'
  | 'FS_CROSS_DEVICE'
  | 'FS_INVALID_NAME'
  | 'FS_ALREADY_EXISTS'
  | 'FS_CIRCULAR_MOVE'
  | 'FS_TRAVERSAL'
  // Database
  | 'DB_MIGRATION_FAILED'
  | 'DB_CORRUPT'
  | 'DB_WRITE_FAILED'
  // Agent
  | 'AGENT_LLM_UNREACHABLE'
  | 'AGENT_LLM_RATE_LIMITED'
  | 'AGENT_LLM_AUTH_FAILED'
  | 'AGENT_LLM_MALFORMED_RESPONSE'
  | 'AGENT_INTENTION_FAILED'
  | 'AGENT_EMBEDDING_FAILED'
  // Engine
  | 'ENGINE_WEBGL_LOST'
  | 'ENGINE_PHYSICS_INIT_FAILED'
  // IPC
  | 'IPC_TIMEOUT'
  | 'IPC_UNKNOWN_CHANNEL'
  // Generic
  | 'UNKNOWN';

export interface DaxError {
  code: DaxErrorCode;
  message: string;
  details?: string;
  path?: string;
}
