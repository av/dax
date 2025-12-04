# Data Model: Dax Core Platform

**Feature**: 001-dax-core | **Date**: 2024-12-04

## Core Entities

### Vector3

Common type for 3D positions and dimensions.

```typescript
interface Vector3 {
  x: number;
  y: number;
  z: number;
}
```

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Vector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}
```

---

### DataObject (Base)

Abstract base for all entities on the plane.

```typescript
interface DataObject {
  id: string;                    // UUID
  type: DataObjectType;          // discriminator
  position: Vector3;             // world position
  rotation: Vector3;             // euler angles (radians)
  scale: Vector3;                // size multiplier
  velocity: Vector3;             // physics velocity
  isStatic: boolean;             // exclude from physics
  isSelected: boolean;           // selection state
  createdAt: number;             // unix timestamp ms
  updatedAt: number;             // unix timestamp ms
  metadata: Record<string, unknown>; // extensible data
}

type DataObjectType = 'file' | 'snippet' | 'boundary' | 'beacon';
```

---

### FileObject

Represents a file from the filesystem.

```typescript
interface FileObject extends DataObject {
  type: 'file';
  path: string;                  // absolute filesystem path
  name: string;                  // display name
  extension: string;             // file extension (lowercase, no dot)
  category: FileCategory;        // derived from extension
  sizeBytes: number;             // file size
  mimeType: string;              // detected MIME type
  preview?: FilePreview;         // optional preview data
  isEditable: boolean;           // can open in editor
  lastModified: number;          // filesystem mtime
}

type FileCategory =
  | 'text'       // .txt, .md, .json, .xml, etc.
  | 'code'       // .ts, .js, .py, .rs, .go, etc.
  | 'image'      // .png, .jpg, .gif, .svg, etc.
  | 'document'   // .pdf, .docx, .xlsx, etc.
  | 'data'       // .csv, .parquet, .sql, etc.
  | 'archive'    // .zip, .tar, .gz, etc.
  | 'media'      // .mp3, .mp4, .wav, etc.
  | 'unknown';

interface FilePreview {
  type: 'thumbnail' | 'text' | 'none';
  data?: string;  // base64 image or text excerpt
}
```

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FileObject {
    pub id: String,
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    pub category: FileCategory,
    pub size_bytes: u64,
    pub mime_type: String,
    pub is_editable: bool,
    pub last_modified: u64,
    pub position: Vector3,
    pub rotation: Vector3,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum FileCategory {
    Text,
    Code,
    Image,
    Document,
    Data,
    Archive,
    Media,
    Unknown,
}
```

---

### Snippet

User-created or agent-generated text fragment.

```typescript
interface Snippet extends DataObject {
  type: 'snippet';
  content: string;               // text content
  title?: string;                // optional display title
  sourceFileId?: string;         // linked file (if extracted)
  sourceRange?: TextRange;       // line range in source
  tags: string[];                // user/agent tags
  color: string;                 // hex color for visual
}

interface TextRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}
```

---

### Boundary

Zone with associated instructions for agent behavior.

```typescript
interface Boundary extends DataObject {
  type: 'boundary';
  vertices: Vector3[];           // polygon vertices (closed)
  instructions: BoundaryInstruction[];
  color: string;                 // hex color with alpha
  label?: string;                // display name
  isActive: boolean;             // whether agent respects it
}

interface BoundaryInstruction {
  id: string;
  action: BoundaryAction;
  parameters: Record<string, unknown>;
  priority: number;              // higher = more important
}

type BoundaryAction =
  | 'organize'       // organize files by criteria
  | 'summarize'      // summarize contents
  | 'review'         // code review focus
  | 'ignore'         // agent ignores this zone
  | 'protect'        // prevent modifications
  | 'custom';        // freeform instruction text
```

---

### Beacon

Point influence on agent behavior.

```typescript
interface Beacon extends DataObject {
  type: 'beacon';
  beaconType: BeaconType;
  radius: number;                // influence radius in world units
  intensity: number;             // 0-1 strength multiplier
  color: string;                 // visual color
  label?: string;                // display name
  isActive: boolean;             // whether currently active
}

type BeaconType =
  | 'attract'        // prioritize nearby objects
  | 'repel'          // avoid this area
  | 'speed'          // work faster (less thorough)
  | 'careful'        // work slower (more thorough)
  | 'notify'         // alert user when agent near
  | 'pause';         // agent pauses in radius
```

---

### Agent

The AI entity state.

```typescript
interface Agent {
  id: string;                    // singleton but still has ID
  position: Vector3;             // current location
  targetPosition?: Vector3;      // movement destination
  state: AgentState;
  currentGoal?: string;          // goal ID being worked
  focusedObjectId?: string;      // object being analyzed
  personality: AgentPersonality;
  config: AgentConfig;
}

type AgentState =
  | 'idle'           // waiting for work
  | 'moving'         // pathfinding to target
  | 'analyzing'      // examining an object
  | 'thinking'       // processing with LLM
  | 'executing'      // running sandbox code
  | 'waiting'        // waiting for user input
  | 'paused';        // user-paused

interface AgentPersonality {
  name: string;                  // display name
  avatar: string;                // 3D model identifier
  voiceTone: 'formal' | 'casual' | 'technical';
}

interface AgentConfig {
  autonomyLevel: 'passive' | 'active' | 'proactive';
  maxConcurrentGoals: number;
  analysisDepth: 'shallow' | 'medium' | 'deep';
  movementSpeed: number;         // world units per second
  llmProvider: string;           // 'openai' | 'anthropic' | 'local'
  llmModel: string;              // model identifier
}
```

---

### Goal

Agent objective tracking.

```typescript
interface Goal {
  id: string;
  type: GoalType;
  title: string;                 // short description
  description: string;           // detailed description
  status: GoalStatus;
  priority: number;              // 1-10, higher = more urgent
  progress: number;              // 0-100 percentage
  relatedObjectIds: string[];    // objects involved
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: GoalResult;
  parentGoalId?: string;         // for sub-goals
}

type GoalType =
  | 'analyze'        // understand file contents
  | 'organize'       // arrange related files
  | 'summarize'      // create summary snippet
  | 'review'         // code review
  | 'execute'        // run code
  | 'custom';        // user-defined

type GoalStatus =
  | 'pending'        // queued
  | 'active'         // in progress
  | 'blocked'        // waiting for something
  | 'completed'      // successfully done
  | 'cancelled'      // user cancelled
  | 'failed';        // error occurred

interface GoalResult {
  success: boolean;
  output?: string;               // text output
  createdObjects?: string[];     // new object IDs
  modifiedObjects?: string[];    // changed object IDs
  error?: string;                // error message if failed
}
```

---

### Workspace

Top-level container for persistence.

```typescript
interface Workspace {
  id: string;
  name: string;
  path: string;                  // save location
  objects: DataObject[];
  agent: Agent;
  goals: Goal[];
  cameraState: CameraState;
  settings: WorkspaceSettings;
  createdAt: number;
  updatedAt: number;
  version: string;               // schema version for migrations
}

interface CameraState {
  position: Vector3;
  target: Vector3;               // look-at point
  zoom: number;
  rotation: Vector3;
}

interface WorkspaceSettings {
  gridVisible: boolean;
  physicsEnabled: boolean;
  agentAutonomy: boolean;
  theme: 'light' | 'dark' | 'system';
}
```

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub created_at: u64,
    pub updated_at: u64,
    pub version: String,
}
```

---

### ChatMessage

Agent-user communication.

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  relatedObjectIds?: string[];   // context objects
  relatedGoalId?: string;        // related goal
}
```

---

### SandboxExecution

Code execution record.

```typescript
interface SandboxExecution {
  id: string;
  language: 'python' | 'javascript' | 'shell';
  code: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  startedAt?: number;
  completedAt?: number;
  output?: string;
  error?: string;
  initiator: 'user' | 'agent';
  permissions: SandboxPermissions;
}

interface SandboxPermissions {
  readFiles: boolean;
  writeFiles: boolean;
  networkAccess: boolean;
  maxExecutionMs: number;
  maxMemoryMb: number;
}
```

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxExecution {
    pub id: String,
    pub language: SandboxLanguage,
    pub code: String,
    pub status: ExecutionStatus,
    pub output: Option<String>,
    pub error: Option<String>,
    pub started_at: Option<u64>,
    pub completed_at: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum SandboxLanguage {
    Python,
    JavaScript,
    Shell,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Timeout,
}
```

---

## Entity Relationships

```
Workspace (1) ─────────┬─────── (*) DataObject
                       ├─────── (1) Agent
                       ├─────── (*) Goal
                       └─────── (*) ChatMessage

DataObject <|── FileObject
           <|── Snippet
           <|── Boundary
           <|── Beacon

Agent (1) ───────────── (*) Goal
      │
      └─ focuses on ─── (0..1) DataObject

Goal ──────────────────── (*) DataObject (related)
    │
    └─ parent/child ──── (*) Goal

Snippet (0..1) ────────── (0..1) FileObject (source)

Boundary ──────────────── (*) BoundaryInstruction

SandboxExecution ──────── (*) DataObject (affected)
```

---

## SQLite Schema (Persistence)

```sql
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    camera_state TEXT NOT NULL,  -- JSON
    settings TEXT NOT NULL,       -- JSON
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    version TEXT NOT NULL
);

CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,           -- discriminator
    data TEXT NOT NULL,           -- JSON blob
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_objects_workspace ON objects(workspace_id);
CREATE INDEX idx_objects_type ON objects(type);

CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    data TEXT NOT NULL,           -- JSON blob
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE chat_history (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE INDEX idx_chat_workspace ON chat_history(workspace_id);
```
