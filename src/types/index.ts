// ── File Tree ────────────────────────────────────────────

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension: string | null;
  sizeBytes: number;
  modifiedAt: number;
  parentId: string | null;
  children?: FileNode[];  // Only populated by buildNestedTree(); never stored in the flat store
  position?: [number, number, number]; // Computed by layout engine; not persisted
  metadata?: Record<string, unknown>;
}

// ── File System Events ──────────────────────────────────

export interface FileChangeEventStat {
  sizeBytes: number;
  modifiedAt: number;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  sessionId: number;
  fileInfo?: FileChangeEventStat;
}

export interface WatcherInitPayload {
  sessionId: number;
  tree: FileNode[];       // flat list, parentId links
  gapEvents: FileChangeEvent[];
}

export interface WatcherErrorEvent {
  sessionId: number;
  error: string;
}

// ── Settings ────────────────────────────────────────────

export interface AppSettings {
  llm: LLMConfig;
  theme: 'dark' | 'light';
  cameraSpeed: number;
  lastOpenedFolder: string | null;
}

export interface LLMConfig {
  apiEndpoint: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  systemPromptOverride: string | null;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ── Agent ───────────────────────────────────────────────

export enum AgentState {
  Idle = 'idle',
  Thinking = 'thinking',
  Acting = 'acting',
  Error = 'error',
  WaitingApproval = 'waiting-approval',
}

export interface AgentStep {
  id: string;
  description: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'running' | 'done' | 'failed' | 'rejected';
  result?: string;
  error?: string;
}

// ── Scene Persistence ────────────────────────────────────

export interface SceneObjectRow {
  id: number;
  workspace_id: number;
  object_type: string;
  label: string | null;
  visible: number;
  opacity: number;
  color_override: string | null;
  pos_x: number | null; pos_y: number | null; pos_z: number | null;
  rot_x: number | null; rot_y: number | null; rot_z: number | null; rot_w: number | null;
  scale_x: number; scale_y: number; scale_z: number;
  lin_vel_x: number; lin_vel_y: number; lin_vel_z: number;
  ang_vel_x: number; ang_vel_y: number; ang_vel_z: number;
  is_sleeping: number;
  is_pinned: number;
  mass: number | null;
  restitution: number | null;
  friction: number | null;
  created_at: number;
  updated_at: number;
}

export interface EntityLinkRow {
  scene_object_id: number;
  entity_type: string;
  entity_id: number;
}

export interface GeometryObjectRow {
  scene_object_id: number;
  geometry_type: string;
  geometry_data: string; // JSON
}

export interface SpatialRelationRow {
  id: number;
  workspace_id: number;
  source_object_id: number;
  target_object_id: number;
  relation_type: string;
  offset_x: number | null; offset_y: number | null; offset_z: number | null;
  offset_rot_x: number | null; offset_rot_y: number | null;
  offset_rot_z: number | null; offset_rot_w: number | null;
  created_at: number;
}

export interface AttributeRow {
  id: number;
  scene_object_id: number;
  key: string;
  value: string;
  value_type: string;
  created_at: number;
  updated_at: number;
}

export interface TagRow {
  id: number;
  name: string;
  color: string | null;
}

export interface SceneObjectTagRow {
  scene_object_id: number;
  tag_id: number;
  tag_name: string;
  tag_color: string | null;
}

/** Denormalised snapshot returned by workspace:loadScene */
export interface SceneObjectSnapshot {
  sceneObject: SceneObjectRow;
  entityLink: EntityLinkRow | null;
  geometryObject: GeometryObjectRow | null;
  filePath: string | null;    // resolved from files table
  dirPath: string | null;     // resolved from directories table
  attributes: AttributeRow[];
  tags: SceneObjectTagRow[];
}

export interface SpatialRelationSnapshot {
  id: number;
  source_object_id: number;
  target_object_id: number;
  relation_type: string;
  offset_x: number | null; offset_y: number | null; offset_z: number | null;
  offset_rot_x: number | null; offset_rot_y: number | null;
  offset_rot_z: number | null; offset_rot_w: number | null;
}

export interface SceneSnapshot {
  workspaceId: number;
  objects: SceneObjectSnapshot[];
  relations: SpatialRelationSnapshot[];
}

export interface SaveSceneObject {
  fileNodeId: string;          // renderer's hex ID (16-char sha256 of path)
  filePath: string;
  objectType: 'file' | 'directory';
  pos_x: number; pos_y: number; pos_z: number;
  rot_x: number; rot_y: number; rot_z: number; rot_w: number;
  scale_x: number; scale_y: number; scale_z: number;
  lin_vel_x: number; lin_vel_y: number; lin_vel_z: number;
  ang_vel_x: number; ang_vel_y: number; ang_vel_z: number;
  is_sleeping: number;
  is_pinned: number;
}

export interface TaggedObject {
  scene_object_id: number;
  tags: TagRow[];
}

// ── IPC Bridge ──────────────────────────────────────────

export interface DaxAPI {
  openFolder(): Promise<string | null>;
  readDirectory(path: string): Promise<FileNode[]>;
  statFile(path: string): Promise<FileNode | null>;
  readFileContent(path: string): Promise<string>;
  readBinaryFile(path: string): Promise<string>;
  writeFileContent(path: string, content: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  renameFile(path: string, newName: string): Promise<void>;
  openExternal(path: string): Promise<void>;
  watchFolder(path: string): Promise<WatcherInitPayload>;
  onFileChange(callback: (event: { sessionId: number; events: FileChangeEvent[] }) => void): () => void;
  onWatcherError(callback: (event: WatcherErrorEvent) => void): () => void;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  testLLMConnection(config: LLMConfig): Promise<boolean>;
  sendLLMMessage(messages: LLMMessage[], config: LLMConfig): Promise<string>;
  abortLLM(): Promise<void>;

  // ── Workspace / Scene Persistence ─────────────────────
  workspaceOpen(path: string, name: string): Promise<{ workspaceId: number }>;
  workspaceLoadScene(workspaceId: number): Promise<SceneSnapshot>;
  workspaceSaveScene(workspaceId: number, objects: SaveSceneObject[]): Promise<void>;
  workspaceUpsertAttributes(sceneObjectId: number, attrs: Record<string, string>): Promise<void>;
  workspaceLoadAttributes(sceneObjectId: number): Promise<AttributeRow[]>;
  workspaceSaveTags(sceneObjectId: number, tagIds: number[]): Promise<void>;
  workspaceLoadTags(workspaceId: number): Promise<TaggedObject[]>;
  workspaceSaveEmbedding(fileId: number, model: string, vector: number[]): Promise<void>;
  workspaceSearchByEmbedding(vector: number[], limit?: number): Promise<{ fileId: number; distance: number }[]>;
}
