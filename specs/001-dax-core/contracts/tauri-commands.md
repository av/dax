# Tauri Commands Contract

**Feature**: 001-dax-core | **Date**: 2024-12-04

## Overview

All Tauri commands use the `invoke` IPC mechanism. Commands are async and return `Result<T, String>` on the Rust side, which translates to Promise resolution/rejection on the frontend.

## File Operations

### `read_file`

Read file content as text or binary.

```typescript
// Frontend
const content = await invoke<FileContent>('read_file', { path: string });

interface FileContent {
  text?: string;      // for text files
  binary?: number[];  // for binary files (base64 in practice)
  encoding: string;   // detected encoding
}
```

```rust
#[tauri::command]
async fn read_file(path: PathBuf) -> Result<FileContent, String>
```

---

### `write_file`

Write content to file.

```typescript
await invoke('write_file', {
  path: string,
  content: string,
  createDirs: boolean  // create parent directories if missing
});
```

```rust
#[tauri::command]
async fn write_file(path: PathBuf, content: String, create_dirs: bool) -> Result<(), String>
```

---

### `get_file_metadata`

Get file metadata without reading content.

```typescript
const meta = await invoke<FileMetadata>('get_file_metadata', { path: string });

interface FileMetadata {
  path: string;
  name: string;
  extension: string;
  sizeBytes: number;
  mimeType: string;
  isReadable: boolean;
  isWritable: boolean;
  lastModified: number;  // unix timestamp
  category: FileCategory;
}
```

```rust
#[tauri::command]
async fn get_file_metadata(path: PathBuf) -> Result<FileMetadata, String>
```

---

### `watch_file`

Start watching file for external changes.

```typescript
await invoke('watch_file', { path: string, id: string });
// Emits 'file-changed' event when file modified externally
```

```rust
#[tauri::command]
async fn watch_file(path: PathBuf, id: String, app: tauri::AppHandle) -> Result<(), String>
```

---

### `unwatch_file`

Stop watching file.

```typescript
await invoke('unwatch_file', { id: string });
```

---

### `generate_preview`

Generate preview for file (thumbnail or text excerpt).

```typescript
const preview = await invoke<FilePreview>('generate_preview', {
  path: string,
  maxWidth: number,   // for image thumbnails
  maxHeight: number,
  textLines: number   // for text excerpts
});

interface FilePreview {
  type: 'thumbnail' | 'text' | 'none';
  data?: string;  // base64 image or text
  mimeType?: string;
}
```

---

## Workspace Persistence

### `create_workspace`

Create new workspace.

```typescript
const workspace = await invoke<Workspace>('create_workspace', {
  name: string,
  path: string  // save location
});
```

---

### `load_workspace`

Load workspace from disk.

```typescript
const workspace = await invoke<Workspace>('load_workspace', {
  path: string
});
```

---

### `save_workspace`

Save workspace state.

```typescript
await invoke('save_workspace', {
  workspace: Workspace
});
```

---

### `export_workspace`

Export workspace to portable format.

```typescript
await invoke('export_workspace', {
  workspaceId: string,
  exportPath: string,
  includeFiles: boolean  // copy files or just references
});
```

---

## Sandbox Execution

### `execute_code`

Run code in sandbox.

```typescript
const result = await invoke<SandboxResult>('execute_code', {
  code: string,
  language: 'python' | 'javascript' | 'shell',
  permissions: SandboxPermissions,
  workingDir?: string
});

interface SandboxResult {
  id: string;
  status: 'completed' | 'failed' | 'timeout';
  stdout: string;
  stderr: string;
  exitCode?: number;
  executionMs: number;
}
```

```rust
#[tauri::command]
async fn execute_code(
    code: String,
    language: SandboxLanguage,
    permissions: SandboxPermissions,
    working_dir: Option<PathBuf>
) -> Result<SandboxResult, String>
```

---

### `cancel_execution`

Cancel running sandbox execution.

```typescript
await invoke('cancel_execution', { executionId: string });
```

---

### `list_available_runtimes`

Check which sandbox runtimes are available.

```typescript
const runtimes = await invoke<RuntimeInfo[]>('list_available_runtimes');

interface RuntimeInfo {
  language: string;
  version: string;
  available: boolean;
  path?: string;
}
```

---

## System Integration

### `open_file_dialog`

Native file picker.

```typescript
const paths = await invoke<string[]>('open_file_dialog', {
  multiple: boolean,
  directory: boolean,
  filters: FileFilter[]
});

interface FileFilter {
  name: string;
  extensions: string[];
}
```

---

### `reveal_in_explorer`

Open file in system file manager.

```typescript
await invoke('reveal_in_explorer', { path: string });
```

---

### `get_system_info`

Get system capabilities.

```typescript
const info = await invoke<SystemInfo>('get_system_info');

interface SystemInfo {
  platform: 'windows' | 'macos' | 'linux';
  arch: string;
  cpuCores: number;
  memoryMb: number;
  gpuInfo?: string;
}
```

---

## LLM Integration

### `call_llm`

Make LLM API request (proxied through backend for API key security).

```typescript
const response = await invoke<LLMResponse>('call_llm', {
  provider: string,
  model: string,
  messages: ChatMessage[],
  options: LLMOptions
});

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;  // if true, use event stream instead
}

interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  finishReason: string;
}
```

---

### `stream_llm`

Start streaming LLM response.

```typescript
await invoke('stream_llm', {
  requestId: string,
  provider: string,
  model: string,
  messages: ChatMessage[],
  options: LLMOptions
});
// Listen for 'llm-chunk' events with requestId
// Listen for 'llm-complete' or 'llm-error' for completion
```

---

### `cancel_llm_stream`

Cancel ongoing LLM stream.

```typescript
await invoke('cancel_llm_stream', { requestId: string });
```

---

## Events (Backend → Frontend)

Events emitted by the Rust backend to the frontend.

| Event | Payload | Description |
|-------|---------|-------------|
| `file-changed` | `{ id: string, path: string, changeType: 'modified' \| 'deleted' }` | Watched file changed |
| `llm-chunk` | `{ requestId: string, content: string, index: number }` | Streaming LLM token |
| `llm-complete` | `{ requestId: string, usage: object }` | LLM stream finished |
| `llm-error` | `{ requestId: string, error: string }` | LLM stream failed |
| `sandbox-output` | `{ executionId: string, stream: 'stdout' \| 'stderr', data: string }` | Sandbox output (if streaming) |
| `workspace-autosaved` | `{ workspaceId: string, path: string }` | Auto-save completed |

---

## Error Handling

All commands return errors as rejected promises with string messages. Error categories:

| Prefix | Meaning |
|--------|---------|
| `IO:` | File system error |
| `PERM:` | Permission denied |
| `NOT_FOUND:` | Resource not found |
| `INVALID:` | Invalid input |
| `TIMEOUT:` | Operation timed out |
| `SANDBOX:` | Sandbox security violation |
| `LLM:` | LLM API error |
| `INTERNAL:` | Unexpected internal error |
