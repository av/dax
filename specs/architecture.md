# DAX — System Architecture & Milestone Decomposition

**Version:** 1.0.0
**Date:** 2026-03-04
**Status:** Draft
**Derived from:** [specification.md](specification.md), [concept.md](concept.md)

---

## PART A: ARCHITECTURE

### 1. Directory Structure

```
dax/
├── specs/                              — Project specification documents
│   ├── concept.md                      — High-level product concept and vision
│   ├── specification.md                — Comprehensive feature specs, data model, edge cases
│   └── architecture.md                 — This file: architecture + milestones
│
├── package.json                        — Root package: scripts, dependencies, workspace config
├── tsconfig.json                       — Root TypeScript config (project references)
├── tsconfig.base.json                  — Shared compiler options (strict, paths, target)
├── vite.config.ts                      — Vite config for renderer bundle (solid plugin, aliases)
├── vite.main.config.ts                 — Vite config for main process bundle (node externals)
├── vite.preload.config.ts              — Vite config for preload script bundle
├── forge.config.ts                     — Electron Forge packaging/publishing config
├── drizzle.config.ts                   — Drizzle-kit migration config (DB path, schema location)
├── vitest.config.ts                    — Vitest test runner config
├── eslint.config.js                    — ESLint flat config (import/no-cycle, solid plugin)
├── prettier.config.js                  — Prettier formatting rules
├── .gitignore                          — Ignores: node_modules, dist, out, *.db, logs
│
├── resources/                          — Static assets bundled into the Electron app
│   ├── icons/                          — App icons (icns, ico, png) for each platform
│   │   ├── icon.icns                   — macOS app icon
│   │   ├── icon.ico                    — Windows app icon
│   │   └── icon.png                    — Linux app icon (512x512)
│   ├── ripgrep/                        — Platform-specific ripgrep binaries
│   │   ├── rg-linux-x64               — ripgrep binary for Linux x64
│   │   ├── rg-darwin-arm64            — ripgrep binary for macOS ARM64
│   │   ├── rg-darwin-x64             — ripgrep binary for macOS x64
│   │   └── rg-win32-x64.exe          — ripgrep binary for Windows x64
│   └── models/                         — 3D model assets (agent avatar, environment)
│       └── agent-avatar.glb            — Agent character model (glTF binary)
│
├── drizzle/                            — Generated migration SQL files (drizzle-kit output)
│   └── 0000_initial.sql               — Initial schema migration
│
├── src/
│   ├── main/                           — Electron main process (Node.js context)
│   │   ├── index.ts                    — Main process entry: app lifecycle, window creation
│   │   ├── window.ts                   — BrowserWindow factory: creates main window with security opts
│   │   ├── ipc.ts                      — IPC handler registration: routes all ipcMain.handle() calls
│   │   ├── menu.ts                     — Application menu bar definition (File, View, Agent, Help)
│   │   ├── db/
│   │   │   ├── index.ts                — Database connection factory: opens Turso, runs migrations
│   │   │   ├── schema.ts              — Drizzle schema definitions (all tables: app_config, scene_objects, etc.)
│   │   │   ├── migrations.ts          — Migration runner: version check, backup, sequential apply
│   │   │   ├── config-repo.ts         — Repository for app_config table (get/set key-value pairs)
│   │   │   ├── scene-repo.ts          — Repository for scene_objects table (CRUD, batch upsert)
│   │   │   ├── agent-repo.ts          — Repository for agent_state, agent_instructions, agent_action_log
│   │   │   └── chat-repo.ts           — Repository for chat_messages table (insert, query by time range)
│   │   ├── fs/
│   │   │   ├── index.ts               — FS service barrel: re-exports watcher, scanner, operations
│   │   │   ├── scanner.ts             — Recursive directory scanner: reads tree up to depth limit, returns entries
│   │   │   ├── watcher.ts             — Chokidar watcher: start/stop/restart, event normalization, debouncing
│   │   │   ├── operations.ts          — File CRUD: create, rename, move, delete (shell.trashItem), open
│   │   │   ├── search.ts             — Content search via ripgrep child process spawn + output parsing
│   │   │   └── validators.ts          — Path/filename validation: invalid chars, traversal checks, length
│   │   ├── agent/
│   │   │   ├── index.ts               — Agent main-process service: starts OpenCode server, exposes IPC
│   │   │   ├── opencode.ts            — OpenCode SDK wrapper: createOpencode(), session management, health
│   │   │   └── crypto.ts              — API key encryption/decryption via Electron safeStorage
│   │   └── logger.ts                  — Structured logger: file rotation, log levels, paths (~/.dax/logs/)
│   │
│   ├── preload/
│   │   └── index.ts                    — contextBridge.exposeInMainWorld('dax', { ...typedAPI })
│   │
│   ├── renderer/                       — Electron renderer process (browser context)
│   │   ├── index.tsx                   — Renderer entry: mounts Solid.js root, initializes engine
│   │   ├── index.html                  — HTML shell: <div id="app">, <canvas id="render-canvas">
│   │   ├── global.css                  — Global styles: CSS reset, CSS variables, font imports
│   │   │
│   │   ├── core/                       — App bootstrap and cross-cutting concerns
│   │   │   ├── index.ts               — Core barrel: re-exports bootstrap, ipc-client
│   │   │   ├── bootstrap.ts           — App initialization sequence: DB check → config load → watcher start → scene build
│   │   │   └── ipc-client.ts          — Typed IPC client: wraps window.dax.* calls with error handling + timeouts
│   │   │
│   │   ├── engine/                     — Babylon.js 3D engine layer
│   │   │   ├── index.ts               — Engine barrel: re-exports scene manager, mesh factory, etc.
│   │   │   ├── scene.ts               — Scene manager: creates Engine, Scene, attaches to canvas, render loop
│   │   │   ├── physics.ts             — Physics setup: Havok plugin init, ground plane collider, body factory
│   │   │   ├── camera.ts              — RTS camera rig: pan (middle-mouse/WASD), zoom (scroll), rotate (shift+middle), edge scroll, clamp bounds
│   │   │   ├── lighting.ts            — Lighting setup: hemispheric ambient + directional with shadow generator (PCF 2048)
│   │   │   ├── materials.ts           — Material palette: PBR materials per file type (code=blue, image=green, doc=amber, folder=slate, etc.)
│   │   │   ├── mesh-factory.ts        — Creates file/folder meshes: rounded box for files, open-top container for folders, labels, LOD levels
│   │   │   ├── mesh-pool.ts           — Instance mesh pool: pre-allocates geometry, reuses across identical types
│   │   │   ├── animations.ts          — Animation library: fadeIn, dissolve, pulse, popIn, renamFlash, pickUp, carry, place, agentWalk
│   │   │   ├── selection.ts           — Selection system: highlight layer, outline shader, multi-select, ghost outlines during drag
│   │   │   ├── interaction.ts         — Input handling: ray picking, grab/drag/throw, double-click open, drop detection
│   │   │   ├── lod.ts                 — Level-of-detail manager: LOD0 (full), LOD1 (simplified), LOD2 (billboard sprite)
│   │   │   └── scene-bridge.ts        — Signal→Scene bridge: createEffect() watchers that sync state signals to Babylon.js scene graph
│   │   │
│   │   ├── fs/                         — Filesystem service (renderer-side, all calls go through IPC)
│   │   │   ├── index.ts               — FS barrel: re-exports fs-service
│   │   │   └── fs-service.ts          — Async wrappers over IPC: scanDir, createFile, rename, move, delete, openFile, stat, search
│   │   │
│   │   ├── agent/                      — Agent BDI engine and UI integration (renderer-side)
│   │   │   ├── index.ts               — Agent barrel: re-exports bdi, avatar, learning
│   │   │   ├── bdi.ts                 — BDI engine: belief update, desire evaluation, intention selection, plan execution loop
│   │   │   ├── beliefs.ts             — Belief definitions: workspace state beliefs, user preference beliefs, typed belief schema
│   │   │   ├── desires.ts             — Desire definitions: organize_workspace, assist_user, learn_preferences, with priority scoring
│   │   │   ├── intentions.ts          — Intention planner: maps desire+belief pairs to executable plan steps
│   │   │   ├── capabilities.ts        — AgentCapability interface + built-in capabilities: organize, search, create, move
│   │   │   ├── avatar.ts              — Agent avatar controller: 3D model loading, walk animation, idle/thinking/acting states
│   │   │   ├── action-queue.ts        — Sequential action queue: enqueue, dequeue, cancel, pause/resume
│   │   │   ├── learning.ts            — Instruction matching: embedding generation (via IPC), cosine similarity, trigger resolution
│   │   │   └── agent-bridge.ts        — Agent→IPC bridge: sends prompts to main (OpenCode), receives results, updates agent signals
│   │   │
│   │   ├── state/                      — Solid.js signal definitions (single source of truth)
│   │   │   ├── index.ts               — State barrel: re-exports all signal stores
│   │   │   ├── file-tree.ts           — createStore for reactive file/folder tree (FileNode[])
│   │   │   ├── scene-objects.ts       — createStore for 3D scene object positions and metadata
│   │   │   ├── selection.ts           — createSignal for selected object IDs (Set<string>)
│   │   │   ├── camera.ts              — createSignal for camera state { position, target, zoom }
│   │   │   ├── agent.ts               — createStore for agent BDI state: beliefs, desires, intention, status
│   │   │   ├── search.ts             — createSignal for search query + createStore for search results
│   │   │   ├── ui.ts                  — createSignal for panel visibility: settings, agentMind, search, metadata, chat
│   │   │   └── config.ts             — createStore for app config (workspace path, theme, preferences)
│   │   │
│   │   ├── gui/                        — Solid.js UI components (DOM overlays on top of 3D canvas)
│   │   │   ├── index.ts               — GUI barrel: re-exports App shell
│   │   │   ├── App.tsx                — Root Solid.js component: canvas + overlay container
│   │   │   ├── panels/
│   │   │   │   ├── WelcomePanel.tsx   — First-launch welcome overlay with "Choose Directory" button
│   │   │   │   ├── MetadataPanel.tsx  — Sidebar: selected file metadata (path, size, dates, permissions)
│   │   │   │   ├── SearchPanel.tsx    — Top overlay: search input, mode toggle (name/content), result list
│   │   │   │   ├── SettingsPanel.tsx  — Modal overlay: tabbed settings (General, Camera, Agent, AI, Performance, Data)
│   │   │   │   ├── AgentMindPanel.tsx — Sidebar: beliefs, desires, current intention, action log
│   │   │   │   └── ChatPanel.tsx      — Bottom bar: chat input, message history, agent speech bubbles
│   │   │   ├── overlays/
│   │   │   │   ├── ContextMenu.tsx    — Positioned context menu (file/folder/empty space variants)
│   │   │   │   ├── FileViewer.tsx     — Built-in file viewer (text, markdown, JSON, images) with close button
│   │   │   │   ├── ConfirmDialog.tsx  — Reusable confirmation dialog (delete, replace, etc.)
│   │   │   │   ├── TextInput.tsx      — Inline text input for rename/create (validation, Enter/Escape)
│   │   │   │   └── Toast.tsx          — Toast notification system (info, warning, error with auto-dismiss)
│   │   │   └── shared/
│   │   │       ├── Button.tsx         — Styled button component (primary, secondary, danger variants)
│   │   │       ├── Input.tsx          — Styled text input with validation display
│   │   │       ├── Toggle.tsx         — Toggle switch for boolean settings
│   │   │       ├── Select.tsx         — Dropdown select component
│   │   │       ├── Tabs.tsx           — Tab navigation component for settings sections
│   │   │       └── Spinner.tsx        — Loading spinner indicator
│   │   │
│   │   ├── layout/                     — d3-force layout engine (runs in Web Worker)
│   │   │   ├── index.ts               — Layout barrel: re-exports layout service
│   │   │   ├── layout-service.ts      — Worker manager: posts graph data, receives positions, handles incremental updates
│   │   │   └── layout.worker.ts       — Web Worker: d3-force simulation (forceLink, forceManyBody, forceCollide, forceCenter), pinned node support
│   │   │
│   │   └── db/                         — Database types (renderer-side, actual DB access goes through IPC to main)
│   │       ├── index.ts               — DB barrel: re-exports types
│   │       └── types.ts               — TypeScript types mirroring drizzle schema: SceneObject, AgentState, Instruction, ActionLog, ChatMessage, AppConfig
│   │
│   └── shared/                         — Shared types between main and renderer (no runtime deps)
│       ├── index.ts                    — Shared barrel: re-exports all shared types
│       ├── ipc-api.ts                  — IPC channel names + request/response type map (DaxAPI interface)
│       ├── file-types.ts              — FileEntry, FolderEntry, FileType enum, extension→type mapping
│       ├── constants.ts               — App constants: depth limit, debounce ms, physics timestep, zoom bounds, etc.
│       ├── errors.ts                  — Typed error codes: DaxError, FSError, AgentError, DBError discriminated union
│       └── events.ts                  — Event payload types: FSEvent, AgentEvent, SceneEvent (used for IPC + signals)
│
├── test/                               — Test files (mirror src/ structure)
│   ├── setup.ts                        — Vitest global setup: mock Electron APIs, test DB factory
│   ├── helpers/
│   │   ├── db.ts                       — Test DB helper: in-memory Turso instance, seed data factories
│   │   ├── fs.ts                       — Test FS helper: tmp directory creation/cleanup, file fixtures
│   │   └── ipc.ts                      — Test IPC helper: mock IPC bridge with type-safe stubs
│   ├── main/
│   │   ├── db/
│   │   │   ├── config-repo.test.ts    — Config repository: get/set/delete, missing key handling
│   │   │   ├── scene-repo.test.ts     — Scene object repository: CRUD, batch upsert, orphan cleanup
│   │   │   └── agent-repo.test.ts     — Agent repository: state persistence, instruction CRUD, log queries
│   │   ├── fs/
│   │   │   ├── scanner.test.ts        — Directory scanning: depth limit, symlinks, permissions, large dirs
│   │   │   ├── watcher.test.ts        — Chokidar watcher: event types, debouncing, batch events
│   │   │   ├── operations.test.ts     — File ops: create/rename/move/delete, error cases, cross-volume
│   │   │   ├── search.test.ts         — Content search: ripgrep spawn, result parsing, binary skip
│   │   │   └── validators.test.ts     — Filename validation: invalid chars, length, traversal
│   │   └── agent/
│   │       └── opencode.test.ts       — OpenCode SDK: session creation, health check, error handling
│   ├── renderer/
│   │   ├── state/
│   │   │   ├── file-tree.test.ts      — File tree signal: add/remove/rename nodes, nested updates
│   │   │   └── agent.test.ts          — Agent state signal: belief updates, status transitions
│   │   ├── agent/
│   │   │   ├── bdi.test.ts            — BDI loop: belief→desire→intention pipeline, priority selection
│   │   │   ├── learning.test.ts       — Instruction matching: cosine similarity, threshold, eviction
│   │   │   └── action-queue.test.ts   — Action queue: enqueue/dequeue, cancellation, pause/resume
│   │   └── layout/
│   │       └── layout-service.test.ts — Layout service: position calculation, incremental update, pinned nodes
│   └── integration/
│       ├── first-launch.test.ts       — UF1: app start → directory select → scene population
│       ├── session-resume.test.ts     — UF2: app start with stored path → scene restore
│       ├── file-operations.test.ts    — UF4-UF6: move, create, delete through full pipeline
│       ├── search.test.ts            — UF7: search → highlight → camera fly-to
│       ├── agent-organize.test.ts    — UF8: user asks agent to organize → files moved
│       ├── agent-learning.test.ts    — UF10: teach agent → trigger → learned action executes
│       └── external-changes.test.ts  — UF12: external file changes → scene updates
│
└── .dax/                               — Runtime data directory (created at ~/.dax on first launch)
    ├── dax.db                          — Turso database file
    ├── logs/
    │   ├── app.log                     — Application log (rotated daily, 7 days)
    │   └── error.log                   — Error log (rotated daily, 30 days)
    └── backups/
        └── dax_v1_backup_*.db          — Pre-migration database backups (max 5)
```

---

### 2. Module Dependency Graph

```
shared/
  ↑ (imported by everything — pure types, zero runtime)
  │
  ├── main/index.ts
  │     ├── main/window.ts              → (Electron BrowserWindow)
  │     ├── main/ipc.ts                 → main/db/*, main/fs/*, main/agent/*
  │     ├── main/menu.ts                → (Electron Menu)
  │     ├── main/logger.ts              → (filesystem, standalone)
  │     ├── main/db/
  │     │     ├── index.ts              → schema.ts, migrations.ts
  │     │     ├── schema.ts             → shared/  (drizzle schema using shared types)
  │     │     ├── migrations.ts         → index.ts (runs against db connection)
  │     │     ├── config-repo.ts        → index.ts, schema.ts
  │     │     ├── scene-repo.ts         → index.ts, schema.ts
  │     │     ├── agent-repo.ts         → index.ts, schema.ts
  │     │     └── chat-repo.ts          → index.ts, schema.ts
  │     ├── main/fs/
  │     │     ├── scanner.ts            → shared/file-types.ts
  │     │     ├── watcher.ts            → shared/events.ts (chokidar)
  │     │     ├── operations.ts         → validators.ts, shared/errors.ts
  │     │     ├── search.ts             → (child_process for ripgrep)
  │     │     └── validators.ts         → shared/constants.ts
  │     └── main/agent/
  │           ├── opencode.ts           → (@opencode-ai/sdk)
  │           └── crypto.ts             → (Electron safeStorage)
  │
  ├── preload/index.ts                  → shared/ipc-api.ts (contextBridge shape)
  │
  └── renderer/
        ├── index.tsx                   → core/, engine/, gui/
        │
        ├── core/
        │     ├── bootstrap.ts          → state/, renderer/fs/, engine/, layout/, agent/
        │     └── ipc-client.ts         → shared/ipc-api.ts (calls window.dax.*)
        │
        ├── state/                      → shared/ (pure signals, no module deps)
        │     ├── file-tree.ts
        │     ├── scene-objects.ts
        │     ├── selection.ts
        │     ├── camera.ts
        │     ├── agent.ts
        │     ├── search.ts
        │     ├── ui.ts
        │     └── config.ts
        │
        ├── engine/                     → state/, shared/ (@babylonjs/*)
        │     ├── scene.ts              → lighting.ts, physics.ts, camera.ts
        │     ├── physics.ts            → (@babylonjs/havok)
        │     ├── camera.ts             → state/camera.ts
        │     ├── lighting.ts           → materials.ts
        │     ├── materials.ts          → shared/file-types.ts
        │     ├── mesh-factory.ts       → materials.ts, mesh-pool.ts, lod.ts
        │     ├── mesh-pool.ts          → (standalone, manages geometry cache)
        │     ├── animations.ts         → (standalone, animation clip library)
        │     ├── selection.ts          → state/selection.ts
        │     ├── interaction.ts        → state/selection.ts, state/scene-objects.ts, selection.ts, animations.ts
        │     ├── lod.ts                → state/camera.ts
        │     └── scene-bridge.ts       → state/*, mesh-factory.ts, animations.ts
        │
        ├── fs/
        │     └── fs-service.ts         → core/ipc-client.ts, shared/file-types.ts
        │
        ├── agent/                      → state/, core/ipc-client.ts, engine/animations.ts
        │     ├── bdi.ts                → beliefs.ts, desires.ts, intentions.ts, agent-bridge.ts
        │     ├── beliefs.ts            → state/file-tree.ts, state/agent.ts
        │     ├── desires.ts            → state/agent.ts
        │     ├── intentions.ts         → capabilities.ts
        │     ├── capabilities.ts       → renderer/fs/fs-service.ts, state/*
        │     ├── avatar.ts             → engine/scene.ts, engine/animations.ts
        │     ├── action-queue.ts       → (standalone queue data structure)
        │     ├── learning.ts           → core/ipc-client.ts, state/agent.ts
        │     └── agent-bridge.ts       → core/ipc-client.ts
        │
        ├── gui/                        → state/, core/ipc-client.ts (Solid.js components)
        │     ├── App.tsx               → panels/*, overlays/*, state/ui.ts
        │     ├── panels/*.tsx          → state/*, shared/, gui/shared/*
        │     ├── overlays/*.tsx        → state/*, shared/, gui/shared/*
        │     └── shared/*.tsx          → (standalone presentational components)
        │
        ├── layout/
        │     ├── layout-service.ts     → state/scene-objects.ts, layout.worker.ts (via Worker)
        │     └── layout.worker.ts      → (d3-force, standalone worker — no imports from app modules)
        │
        └── db/
              └── types.ts              → shared/ (TypeScript type mirrors only)
```

**Key Dependency Rules (enforced via ESLint `import/no-cycle` + custom boundaries):**

| Rule | Description |
|------|-------------|
| `engine/` ✗→ `gui/` | Engine never imports GUI components. They communicate through `state/` signals. |
| `gui/` ✗→ `engine/` | GUI never imports engine internals. State signals are the bridge. |
| `fs/` ✗→ `engine/` ✗→ `gui/` | FS module is purely an IPC wrapper — it knows nothing about rendering or UI. |
| `agent/` ✗→ `engine/` (except `avatar.ts`) | Agent logic communicates via state signals. Only `avatar.ts` touches engine for 3D model control. |
| `state/` ✗→ anything except `shared/` | Signals are leaf nodes. They define reactive state with no upward dependencies. |
| `layout/worker` ✗→ any app module | Web Worker is a pure d3-force computation. It receives data via `postMessage`, returns positions. |
| `shared/` ✗→ anything | Shared types have zero runtime dependencies. Pure TypeScript interfaces and constants. |
| `main/` ✗→ `renderer/` | Main process never imports renderer code. Communication is IPC only. |
| `renderer/` ✗→ `main/` | Renderer never imports main process code. Communication is via `preload/` contextBridge. |

---

### 3. Key Interface Contracts

#### 3.1 IPC API (`shared/ipc-api.ts`)

The single typed contract between main and renderer processes. Every IPC call is defined here.

```typescript
// shared/ipc-api.ts

import type { FileEntry, FolderEntry } from './file-types';
import type { DaxError } from './errors';
import type { FSEvent } from './events';

/** All IPC channels and their request→response type signatures */
export interface DaxAPI {
  // ── Directory ──
  'dialog:selectDirectory': () => Promise<string | null>;

  // ── Config ──
  'config:get': (key: string) => Promise<string | null>;
  'config:set': (key: string, value: string) => Promise<void>;

  // ── Filesystem ──
  'fs:scan': (dirPath: string, maxDepth: number) => Promise<FileEntry[]>;
  'fs:stat': (filePath: string) => Promise<FileStat>;
  'fs:create': (filePath: string, type: 'file' | 'folder') => Promise<void>;
  'fs:rename': (oldPath: string, newPath: string) => Promise<void>;
  'fs:move': (sourcePath: string, targetDir: string) => Promise<void>;
  'fs:delete': (filePath: string) => Promise<void>;
  'fs:open': (filePath: string) => Promise<void>;
  'fs:readText': (filePath: string, maxBytes: number) => Promise<string>;
  'fs:search': (query: string, dir: string, mode: 'name' | 'content') => Promise<SearchResult[]>;
  'fs:folderSize': (dirPath: string) => Promise<number>;
  'fs:validateName': (name: string) => Promise<ValidationResult>;

  // ── Watcher ──
  'watcher:start': (dirPath: string) => Promise<void>;
  'watcher:stop': () => Promise<void>;
  // Events pushed from main→renderer (not request/response):
  'watcher:event': (callback: (event: FSEvent) => void) => void;

  // ── Scene DB ──
  'db:scene:getAll': () => Promise<SceneObjectRow[]>;
  'db:scene:upsert': (obj: SceneObjectRow) => Promise<void>;
  'db:scene:upsertBatch': (objs: SceneObjectRow[]) => Promise<void>;
  'db:scene:delete': (path: string) => Promise<void>;
  'db:scene:deleteOrphans': (validPaths: string[]) => Promise<number>;

  // ── Agent DB ──
  'db:agent:getState': () => Promise<AgentStateRow | null>;
  'db:agent:saveState': (state: AgentStateRow) => Promise<void>;
  'db:agent:getInstructions': () => Promise<InstructionRow[]>;
  'db:agent:saveInstruction': (inst: InstructionRow) => Promise<void>;
  'db:agent:deleteInstruction': (id: string) => Promise<void>;
  'db:agent:logAction': (log: ActionLogRow) => Promise<void>;
  'db:agent:getActionLog': (limit: number, offset: number) => Promise<ActionLogRow[]>;
  'db:agent:pruneLog': (olderThanMs: number) => Promise<number>;

  // ── Chat DB ──
  'db:chat:getMessages': (limit: number, beforeTimestamp?: number) => Promise<ChatMessageRow[]>;
  'db:chat:saveMessage': (msg: ChatMessageRow) => Promise<void>;

  // ── Keyboard Shortcuts ──
  'db:shortcuts:getAll': () => Promise<ShortcutRow[]>;
  'db:shortcuts:save': (shortcut: ShortcutRow) => Promise<void>;
  'db:shortcuts:reset': (action: string) => Promise<void>;

  // ── Agent (OpenCode) ──
  'agent:prompt': (sessionId: string, message: string, context: AgentContext) => Promise<AgentResponse>;
  'agent:createSession': () => Promise<string>;
  'agent:health': () => Promise<boolean>;

  // ── Embeddings ──
  'embeddings:generate': (text: string) => Promise<Float32Array>;
  'embeddings:batchGenerate': (texts: string[]) => Promise<Float32Array[]>;

  // ── Crypto ──
  'crypto:encrypt': (plaintext: string) => Promise<string>;
  'crypto:decrypt': (ciphertext: string) => Promise<string>;

  // ── App ──
  'app:getVersion': () => Promise<string>;
  'app:getPlatform': () => Promise<NodeJS.Platform>;
  'app:getDataPath': () => Promise<string>;
}
```

#### 3.2 File Types (`shared/file-types.ts`)

```typescript
// shared/file-types.ts

export type FileCategory =
  | 'code'      // .ts, .js, .py, .rs, etc.
  | 'image'     // .png, .jpg, .gif, .svg, .webp
  | 'document'  // .pdf, .doc, .txt, .md
  | 'data'      // .json, .csv, .xml, .yaml
  | 'archive'   // .zip, .tar, .gz
  | 'media'     // .mp3, .mp4, .wav
  | 'binary'    // .exe, .bin, .dll, .wasm
  | 'unknown';  // unrecognized extension

export interface FileEntry {
  /** Relative path from workspace root (e.g. 'src/index.ts') */
  path: string;
  /** Filename only (e.g. 'index.ts') */
  name: string;
  /** File extension without dot (e.g. 'ts'), empty string for extensionless */
  extension: string;
  /** 'file' or 'folder' */
  type: 'file' | 'folder';
  /** Categorization derived from extension */
  category: FileCategory;
  /** Relative path of parent folder, null for root-level items */
  parentPath: string | null;
}

export interface FileStat {
  path: string;
  name: string;
  extension: string;
  type: 'file' | 'folder';
  sizeBytes: number;
  sizeHuman: string;           // e.g. '4.2 KB'
  createdAt: number;           // unix ms
  modifiedAt: number;          // unix ms
  permissions: string;         // POSIX string e.g. 'rwxr-xr-x'
  childCount?: number;         // folders only: immediate children
}

export interface SearchResult {
  path: string;
  name: string;
  /** For content search: matching line number */
  lineNumber?: number;
  /** For content search: line content preview */
  linePreview?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;              // e.g. 'Character "/" is not allowed'
}
```

#### 3.3 Events (`shared/events.ts`)

```typescript
// shared/events.ts

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
```

#### 3.4 Errors (`shared/errors.ts`)

```typescript
// shared/errors.ts

export type DaxErrorCode =
  // Filesystem
  | 'FS_NOT_FOUND'        // ENOENT
  | 'FS_PERMISSION'       // EACCES
  | 'FS_DISK_FULL'        // ENOSPC
  | 'FS_NAME_TOO_LONG'    // ENAMETOOLONG
  | 'FS_FILE_IN_USE'      // EBUSY
  | 'FS_CROSS_DEVICE'     // EXDEV
  | 'FS_INVALID_NAME'     // invalid characters in filename
  | 'FS_ALREADY_EXISTS'   // target already exists
  | 'FS_CIRCULAR_MOVE'    // folder into own subdirectory
  | 'FS_TRAVERSAL'        // path escapes workspace root
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
  message: string;             // human-readable
  details?: string;            // technical details / stack trace
  path?: string;               // related file/folder path (if applicable)
}
```

#### 3.5 DB Row Types (`renderer/db/types.ts`)

```typescript
// renderer/db/types.ts

export interface SceneObjectRow {
  id: string;                  // UUIDv7
  path: string;                // relative path from workspace root
  parentPath: string | null;
  type: 'file' | 'folder';
  positionX: number;
  positionY: number;
  positionZ: number;
  isPinned: boolean;
  createdAt: number;           // unix ms
  updatedAt: number;           // unix ms
}

export interface AgentStateRow {
  id: 'singleton';
  beliefs: string;             // JSON
  desires: string;             // JSON
  currentIntention: string | null; // JSON
  status: 'idle' | 'thinking' | 'acting' | 'paused';
  positionX: number;
  positionZ: number;
  updatedAt: number;
}

export interface InstructionRow {
  id: string;                  // UUIDv7
  triggerPattern: string;
  actionDescription: string;
  embedding: ArrayBuffer | null;
  confidence: number;
  usageCount: number;
  lastUsed: number | null;
  isUserCreated: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ActionLogRow {
  id: string;                  // UUIDv7
  timestamp: number;
  actionType: string;
  targetPath: string | null;
  parameters: string | null;   // JSON
  result: 'success' | 'failure';
  errorMessage: string | null;
  intentionId: string | null;
  instructionId: string | null;
  beliefSnapshot: string | null; // JSON
  durationMs: number | null;
}

export interface ChatMessageRow {
  id: string;                  // UUIDv7
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  sessionId: string | null;
}

export interface ShortcutRow {
  action: string;
  keyCombo: string;
  isDefault: boolean;
}

export interface AppConfigRow {
  key: string;
  value: string;               // JSON-serialized
  updatedAt: number;
}
```

#### 3.6 Agent Interfaces (`renderer/agent/`)

```typescript
// renderer/agent/capabilities.ts

export interface AgentCapability {
  /** Unique identifier for this capability */
  id: string;
  /** Human-readable name shown in Agent Mind panel */
  name: string;
  /** Determines if this capability can handle a given intention */
  canHandle(intention: AgentIntention): boolean;
  /** Execute the capability's action. Returns result for logging. */
  execute(intention: AgentIntention, context: CapabilityContext): Promise<CapabilityResult>;
}

export interface CapabilityContext {
  /** IPC client for filesystem operations */
  fs: FSService;
  /** Current file tree signal value */
  fileTree: FileEntry[];
  /** Function to update agent state signals */
  updateState: (patch: Partial<AgentStateSignal>) => void;
  /** Function to enqueue animated actions */
  enqueueAction: (action: AnimatedAction) => void;
  /** Abort signal for cancellation */
  signal: AbortSignal;
}

export interface CapabilityResult {
  success: boolean;
  message: string;
  filesAffected: string[];
  durationMs: number;
}

// renderer/agent/bdi.ts

export interface Belief {
  key: string;
  value: unknown;
  updatedAt: number;
  source: 'system' | 'observation' | 'user' | 'learned';
}

export interface Desire {
  id: string;
  name: string;
  description: string;
  priority: number;            // 1-10, higher = more important
  isActive: boolean;
  conditions: string;          // natural language description of when this desire is relevant
}

export interface AgentIntention {
  id: string;
  desireId: string;
  plan: PlanStep[];
  currentStep: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  estimatedDurationMs: number | null;
}

export interface PlanStep {
  description: string;
  capabilityId: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}
```

#### 3.7 Engine Interfaces (`renderer/engine/`)

```typescript
// renderer/engine/mesh-factory.ts

export interface ObjectMeshConfig {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
  category: FileCategory;
  position: { x: number; y: number; z: number };
}

export interface ObjectMeshHandle {
  id: string;
  mesh: BABYLON.AbstractMesh;
  label: BABYLON.GUI.TextBlock | null;
  physicsBody: BABYLON.PhysicsBody | null;
  lodLevels: BABYLON.AbstractMesh[];
  dispose(): void;
  setPosition(x: number, y: number, z: number): void;
  setLabel(text: string): void;
  setHighlight(enabled: boolean): void;
  setOpacity(value: number): void;
}

// renderer/engine/animations.ts

export type AnimationType =
  | 'fadeIn'
  | 'dissolve'
  | 'pulse'
  | 'popIn'
  | 'renameFlash'
  | 'pickUp'
  | 'carry'
  | 'place'
  | 'agentWalk'
  | 'agentSearchScan'
  | 'agentGesture';

export interface AnimationOptions {
  type: AnimationType;
  target: BABYLON.AbstractMesh;
  duration: number;            // ms
  onComplete?: () => void;
}

// renderer/engine/interaction.ts

export interface DragState {
  objectId: string;
  startPosition: BABYLON.Vector3;
  currentPosition: BABYLON.Vector3;
  velocity: BABYLON.Vector3;   // computed from mouse movement
  isOverFolder: string | null; // folder id being hovered, or null
}

export interface DropTarget {
  type: 'folder' | 'root' | 'none';
  folderId?: string;
  folderPath?: string;
}
```

#### 3.8 Layout Worker Interface (`renderer/layout/`)

```typescript
// renderer/layout/layout-service.ts

/** Message sent TO the layout worker */
export interface LayoutRequest {
  type: 'full' | 'incremental';
  nodes: LayoutNode[];
  links: LayoutLink[];
  pinnedIds: Set<string>;      // IDs with user-set positions (excluded from simulation)
}

export interface LayoutNode {
  id: string;
  x?: number;                  // existing position (if any)
  z?: number;
  radius: number;              // collision radius (based on mesh size)
  fx?: number;                 // fixed X (for pinned nodes)
  fz?: number;                 // fixed Z (for pinned nodes)
}

export interface LayoutLink {
  source: string;              // parent folder ID
  target: string;              // child item ID
}

/** Message received FROM the layout worker */
export interface LayoutResult {
  type: 'positions';
  positions: Map<string, { x: number; z: number }>;
  iterations: number;
  elapsed: number;             // ms
}
```

#### 3.9 State Signal Types (`renderer/state/`)

```typescript
// renderer/state/file-tree.ts
export type FileTreeStore = {
  root: string | null;         // workspace root path
  entries: FileEntry[];        // flat list of all entries
  loading: boolean;
};

// renderer/state/selection.ts
export type SelectionSignal = Set<string>;  // set of object IDs

// renderer/state/camera.ts
export interface CameraState {
  positionX: number;
  positionY: number;
  positionZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  zoom: number;
}

// renderer/state/agent.ts
export interface AgentStateSignal {
  beliefs: Belief[];
  desires: Desire[];
  currentIntention: AgentIntention | null;
  status: AgentStatus;
  avatarPosition: { x: number; z: number };
  chatHistory: ChatMessageRow[];
}

// renderer/state/search.ts
export interface SearchState {
  query: string;
  mode: 'name' | 'content';
  results: SearchResult[];
  isSearching: boolean;
  totalMatches: number;
}

// renderer/state/ui.ts
export interface UIPanelState {
  settings: boolean;
  agentMind: boolean;
  search: boolean;
  metadata: boolean;
  chat: boolean;
  fileViewer: { open: boolean; filePath: string | null };
  contextMenu: { open: boolean; x: number; y: number; target: ContextMenuTarget | null };
  welcome: boolean;
}

export type ContextMenuTarget =
  | { type: 'file'; path: string }
  | { type: 'folder'; path: string }
  | { type: 'empty' };

// renderer/state/config.ts
export interface AppConfigState {
  workspacePath: string | null;
  theme: 'light' | 'dark';
  edgeScrollEnabled: boolean;
  edgeScrollSpeed: number;
  agentEnabled: boolean;
  agentLoopInterval: number;   // seconds
  agentAnimationSpeed: number; // 0.5 | 1 | 2 | 5 | Infinity
  maxRenderedObjects: number;
  shadowQuality: 'low' | 'medium' | 'high';
  physicsQuality: 'low' | 'medium' | 'high';
  reducedMotion: boolean;
}
```

---

### 4. Test Strategy

#### Philosophy

Tests verify behavior through public interfaces, not implementation details. The primary testing seam is the IPC boundary — main process repositories and services are tested via their function signatures, renderer modules are tested via their exported APIs and signal outputs.

#### Test Layers

| Layer | What | How | Tools |
|-------|------|-----|-------|
| **Unit** | Individual repositories, validators, BDI logic, action queue, layout computation | Call exported functions with real Turso (in-memory) or real d3-force. No mocks of internal collaborators. | `vitest` |
| **Integration** | Full user flows crossing IPC boundary | Real main process services + simulated IPC bridge. Real filesystem (tmp dirs). Real Turso DB. | `vitest`, temp filesystem fixtures |
| **Visual** (manual) | 3D rendering, animations, camera controls | Manual verification with dev overlay showing FPS, physics body outlines, signal inspector. | Babylon.js Inspector, custom debug overlay |

#### Unit Test Boundaries

| Module | Test boundary | Real dependencies | What is NOT tested in unit |
|--------|--------------|-------------------|---------------------------|
| `main/db/*-repo.ts` | Repo function signatures | Real in-memory Turso DB | IPC transport |
| `main/fs/scanner.ts` | `scanDirectory(path, depth)` | Real filesystem (tmp dir) | Chokidar integration |
| `main/fs/watcher.ts` | `startWatcher()` → emitted events | Real filesystem (tmp dir) + real chokidar | IPC transport to renderer |
| `main/fs/operations.ts` | `createFile()`, `rename()`, etc. | Real filesystem (tmp dir) | Scene updates |
| `main/fs/validators.ts` | `validateFilename()` | None (pure logic) | — |
| `main/fs/search.ts` | `searchContent(query, dir)` | Real filesystem + real ripgrep binary | Scene highlighting |
| `renderer/state/*.ts` | Signal read/write, derived state | Solid.js test environment | Engine/GUI rendering |
| `renderer/agent/bdi.ts` | BDI loop: beliefs → intention | Real signal stores | LLM calls (stubbed at IPC layer) |
| `renderer/agent/learning.ts` | Cosine similarity matching | Real vectors | Embedding generation (stubbed at IPC layer) |
| `renderer/agent/action-queue.ts` | Enqueue/dequeue/cancel | None (pure logic) | Animations |
| `renderer/layout/layout-service.ts` | Layout request → positions | Real d3-force (in worker or inline) | Babylon.js mesh positioning |

#### Integration Test Scenarios (map to User Flows)

| Test | UF | What it exercises |
|------|-----|-------------------|
| First Launch | UF1 | Config empty → directory select → scan → DB write → scene objects created in state |
| Session Resume | UF2 | Config has path → verify dir → load scene objects → reconcile with FS → camera restore |
| File Operations | UF4-6 | Move file (IPC → fs.rename → watcher event → state update), Create file, Delete file |
| Search | UF7 | Name search (in-memory filter), Content search (ripgrep), result highlighting state |
| Agent Organize | UF8 | User message → BDI intention → capability execution → file moves → action log |
| Agent Learning | UF10 | Teach instruction → store in DB → trigger match → action executes without LLM |
| External Changes | UF12 | Batch file creation/deletion in tmp dir → watcher events → state updates |

#### What We Do NOT Mock

- **Turso DB** — Always use a real in-memory instance (`connect(':memory:')` with migrations applied).
- **Filesystem** — Always use real tmp directories (`fs.mkdtemp`). Cleaned up in `afterEach`.
- **d3-force** — Always run the real simulation (it's deterministic and fast).
- **Chokidar** — Real watcher on real tmp directories with short debounce for test speed.
- **Solid.js signals** — Real reactive runtime in `solid-js/test` mode.

#### What We Stub at IPC Boundary

- **OpenCode SDK / LLM calls** — Stubbed at `main/agent/opencode.ts` to return canned responses. Tests verify the agent processes responses correctly, not that the LLM generates them.
- **Electron native APIs** (`dialog`, `shell`, `safeStorage`) — Stubbed in `test/setup.ts` with predictable return values.
- **ripgrep binary** — For unit tests of `search.ts`, use the real binary on a small tmp directory. If binary not found, skip content search tests gracefully.

#### Test Data Factories (`test/helpers/`)

```typescript
// test/helpers/db.ts
function createTestDB(): Promise<TursoDB>;
function seedSceneObjects(db: TursoDB, count: number): Promise<SceneObjectRow[]>;
function seedAgentState(db: TursoDB): Promise<AgentStateRow>;

// test/helpers/fs.ts
function createTempWorkspace(structure: Record<string, string>): Promise<{ path: string; cleanup: () => void }>;
// Usage: createTempWorkspace({ 'src/index.ts': 'console.log("hi")', 'README.md': '# Hello' })

// test/helpers/ipc.ts
function createMockIPC(overrides?: Partial<DaxAPI>): DaxAPI;
```

#### CI Pipeline

1. `vitest run` — All unit + integration tests
2. `eslint . --ext .ts,.tsx` — Lint (including `import/no-cycle`)
3. `tsc --noEmit` — Type checking
4. `vite build` — Build check (catches import resolution issues)

---

## PART B: MILESTONES

### M1 — Project Scaffold & Electron Shell

**FEATURES:** F26 (modular architecture foundation)
**COMPLEXITY:** Medium
**DURATION ESTIMATE:** ~4 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M1-F1 | Electron + Vite + Solid.js + TypeScript project scaffold with electron-forge |
| M1-F2 | Main/preload/renderer process split with `contextIsolation: true` |
| M1-F3 | Typed IPC bridge (`shared/ipc-api.ts` + `preload/index.ts` + `core/ipc-client.ts`) |
| M1-F4 | Blank Babylon.js canvas rendering in renderer (engine stub) |
| M1-F5 | Solid.js App shell with overlay container on top of canvas |
| M1-F6 | Vitest + ESLint + Prettier config, CI-ready scripts |

#### Entry State
No existing code. Greenfield project.

#### Exit State
A bootable Electron application that opens a window with a Babylon.js canvas (showing a ground plane + ambient light) and a Solid.js overlay (showing "DAX" text). The IPC bridge is established and one round-trip smoke test passes (`app:getVersion` returns the package version). `npm run dev` starts with HMR. `npm run build` produces a packaged app.

#### User Flows Testable After
None fully — but the app launches and renders.

#### Interaction Risks
- Vite + Electron integration can be tricky. `electron-vite` or `vite-plugin-electron` must handle main/preload/renderer bundles.
- Babylon.js canvas must coexist with Solid.js DOM overlay without z-index or pointer event conflicts.

---

### M2 — Database Layer + State Management + Directory Selection

**FEATURES:** F1, F24, F25 (partial: directory config only)
**COMPLEXITY:** Medium
**DURATION ESTIMATE:** ~4 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M2-F1 | Turso DB connection in main process with drizzle-orm schema and migration runner |
| M2-F2 | All DB tables created: `app_config`, `scene_objects`, `agent_state`, `agent_instructions`, `agent_action_log`, `chat_messages`, `keyboard_shortcuts` |
| M2-F3 | Repository layer: `config-repo.ts`, `scene-repo.ts`, `agent-repo.ts`, `chat-repo.ts` |
| M2-F4 | Solid.js signal stores: `file-tree`, `scene-objects`, `selection`, `camera`, `config`, `ui` |
| M2-F5 | Directory selection flow (F1): welcome panel → native dialog → path persisted in DB → loaded on next launch |
| M2-F6 | Pre-migration DB backup + schema versioning |

#### Entry State
M1 exit: bootable Electron shell with blank canvas + Solid.js overlay.

#### Exit State
On first launch: welcome panel appears with "Choose Directory" button. User selects a directory. Path is stored in Turso DB. On relaunch: stored directory is loaded (or re-prompted if missing). Signal stores are initialized and reactive. DB tables exist with all indexes. Repo unit tests pass against real in-memory Turso.

#### User Flows Testable After
- **UF1** (partial — steps 1-5): first launch → select directory → persist.
- **UF2** (partial — steps 1-2): resume → read stored path → verify exists.

#### Interaction Risks
- Turso `@tursodatabase/database` must work in Electron main process (Node.js context). Verify native binding or WASM variant loads.
- Drizzle-orm libSQL dialect must be compatible with Turso's SQLite subset (no triggers, no savepoints).
- Signal store schema must be designed for extensibility — changing signal shapes later will cascade to all consumers.

---

### M3 — Filesystem Mirroring + Watching + Scene Object Creation

**FEATURES:** F2, F3
**COMPLEXITY:** Large
**DURATION ESTIMATE:** ~5 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M3-F1 | Recursive directory scanner with depth limit (default: 5), respects `.gitignore` patterns |
| M3-F2 | `FileEntry` creation: path, name, extension, type, category, parentPath |
| M3-F3 | Chokidar watcher: start/stop, event normalization, 100ms debounce batching |
| M3-F4 | Rename detection (unlink+add with same inode within debounce window) |
| M3-F5 | Watcher events pushed from main→renderer via IPC, updating `file-tree` signal |
| M3-F6 | Scene objects persisted in DB on initial scan + incremental updates |
| M3-F7 | Mesh creation in Babylon.js for each FileEntry (basic box for files, open-top box for folders) with filename labels |
| M3-F8 | File type color coding (PBR materials by category) |
| M3-F9 | Fade-in animation for new objects, dissolve for removed, pulse for changed, rename flash |

#### Entry State
M2 exit: directory selected and stored, DB + signals ready, blank 3D canvas.

#### Exit State
After directory selection, the 3D scene populates with colored, labeled objects representing every file and folder up to depth 5. External file changes (created in terminal) appear as new animated objects within 500ms. Deletions remove objects. Renames update labels. The file tree signal accurately reflects the filesystem state.

#### User Flows Testable After
- **UF1** (full): first launch → select → scene populates.
- **UF2** (full): resume → scene restores from DB + reconciles with disk.
- **UF12**: external file changes → batched scene updates.
- **UF3** (partial): user can see objects in the scene (no interaction yet).

#### Interaction Risks
- Chokidar events and self-initiated file operations (M5) will create feedback loops. Must tag internal operations to distinguish them from external events.
- Large directories (>500 files) must not block the renderer. Scanning runs in main process; mesh creation must be batched with `requestAnimationFrame` breaks.
- Watcher must handle `.gitignore`-style exclusions (e.g., `node_modules`) to avoid overwhelming the scene.

---

### M4 — 3D Engine: Physics, Lighting, Camera, Rendering

**FEATURES:** F12, F13, F16, F27 (partial: LOD + instancing + frustum culling)
**COMPLEXITY:** Large
**DURATION ESTIMATE:** ~6 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M4-F1 | Havok physics initialization (WASM), ground plane static body, dynamic bodies for files, kinematic bodies for folders |
| M4-F2 | Objects fall to ground under gravity, settle via damping, sleep after 2s of rest |
| M4-F3 | Collision detection: object-object, object-ground, object-boundary walls |
| M4-F4 | Scene boundaries (invisible wall colliders) |
| M4-F5 | Hemispheric light (ambient 0.4) + directional light (0.8, 45°) + shadow generator (PCF 2048) |
| M4-F6 | PBR materials (roughness 0.8, metallic 0.1) per file category + gradient sky background + MSAA 4x |
| M4-F7 | RTS camera: pan (middle-mouse/WASD), zoom (scroll, clamped 5-200), rotate (shift+middle), edge scroll |
| M4-F8 | Camera state persistence to DB |
| M4-F9 | LOD system: LOD0 (full mesh), LOD1 (simplified, >100u), LOD2 (billboard, >200u) |
| M4-F10 | Instance mesh pool: file objects of same category share geometry |
| M4-F11 | Frustum culling enabled (Babylon.js default, verified) |
| M4-F12 | Performance monitoring: frame time tracking, auto-shadow-quality reduction when >33ms for 10 frames |

#### Entry State
M3 exit: scene populated with basic meshes, no physics, basic lighting, fixed camera.

#### Exit State
A fully lit, shadow-mapped 3D workspace with physics. Objects settle onto the ground plane with satisfying weight. Camera is fully navigable (pan/zoom/rotate/edge scroll). Performance targets met: ≥30fps with 500 objects on mid-range hardware. LOD visibly kicks in at distance. Physics bodies sleep when at rest.

#### User Flows Testable After
- **UF3** (full): browse and navigate files with RTS camera controls.

#### Interaction Risks
- Havok WASM loading in Electron's renderer may need CSP adjustment for `wasm-eval` or `wasm-unsafe-eval`.
- Physics + rendering performance is the critical path for the entire app. Must profile on mid-range hardware (GTX 1060 / M1 equivalent) early.
- Camera controls conflict with object interaction (M5): middle-mouse for pan vs. left-click for selection needs clear input state machine.

---

### M5 — User Interactions: File Operations + Input System

**FEATURES:** F4, F5, F6, F7, F8, F9, F10, F14, F28
**COMPLEXITY:** Large
**DURATION ESTIMATE:** ~7 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M5-F1 | Ray picking: left-click selects object, shift+click multi-select, ctrl+A select all |
| M5-F2 | Grab/drag: left-click-hold lifts object (kinematic), drag moves on XZ plane, ghost outline at original position |
| M5-F3 | Throw: release with velocity applies physics impulse (clamped to 50u/s), release without velocity drops |
| M5-F4 | Drop detection: object center overlaps folder container → triggers fs.move (F8) |
| M5-F5 | Folder highlight (green glow) when dragged object hovers over it |
| M5-F6 | Double-click file → open in OS default app (`shell.openPath`) or built-in viewer (text, md, json, images) |
| M5-F7 | Double-click folder → camera flies to center on folder contents |
| M5-F8 | Right-click context menu (F28): file/folder/empty-space variants with all options |
| M5-F9 | Create file/folder (F6): context menu → inline text input → fs.writeFile/mkdir → chokidar creates object |
| M5-F10 | Rename (F7): context menu or F2 → inline text input over label → fs.rename |
| M5-F11 | Delete (F9): context menu or Delete key → confirmation dialog → shell.trashItem → dissolve animation |
| M5-F12 | File metadata tooltip (F10): hover 500ms → floating tooltip (name, size, type) |
| M5-F13 | Metadata sidebar panel (F10): click-select → full metadata (path, size, dates, permissions) |
| M5-F14 | Built-in file viewer (F5): text/md/json/image viewer as Solid.js overlay, close with Escape |
| M5-F15 | All keyboard shortcuts from F14 table |
| M5-F16 | File operation queue: serialized writes to prevent race conditions between user actions |
| M5-F17 | Path validation: invalid chars, traversal, length, duplicate name checks |

#### Entry State
M4 exit: physics-lit 3D scene with camera navigation, objects settle on ground, but no interaction.

#### Exit State
Full file management through 3D interaction. Users can grab, drag, throw objects. Files open on double-click. Context menus provide CRUD operations. Keyboard shortcuts work. Metadata is viewable. All file operations are validated and error-handled per edge cases in the spec.

#### User Flows Testable After
- **UF3** (full): browse, hover tooltips, click metadata panel.
- **UF4** (full): drag file into folder → filesystem move.
- **UF5** (full): right-click → new file → typed name → file created.
- **UF6** (full): right-click → delete → confirm → trashed.
- All keyboard shortcuts functional.

#### Interaction Risks
- **Input state machine complexity:** Mouse events serve triple duty — camera control (middle), selection (left-click), drag (left-hold), context menu (right). Must implement a clean state machine: `idle → selecting → dragging → throwing → camera-panning → camera-rotating`.
- **Chokidar feedback loops:** User creates a file via F6 → `fs.writeFile` → chokidar fires `add` → scene tries to create object that's already being created. Solution: tag internal operations with a transaction ID; watcher ignores events for paths with pending internal operations.
- **Physics↔Interaction handoff:** Object must swap between dynamic (physics-driven) and kinematic (user-driven) modes cleanly. Any desynchronization causes jitter or objects falling through the ground.

---

### M6 — Layout Engine + Search + Performance Polish

**FEATURES:** F11, F15, F27 (complete)
**COMPLEXITY:** Medium
**DURATION ESTIMATE:** ~5 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M6-F1 | d3-force layout in Web Worker: forceLink, forceManyBody, forceCollide, forceCenter |
| M6-F2 | Initial layout: positions calculated in <1s for 500 files, written to scene_objects DB |
| M6-F3 | Incremental layout: new files get positioned without moving existing pinned objects |
| M6-F4 | User-moved objects are pinned (`is_pinned=true`, excluded from auto-layout) |
| M6-F5 | "Reset Layout" menu command: clears all pins, re-runs full d3-force |
| M6-F6 | Animated transition: objects glide to new positions when layout recalculates |
| M6-F7 | Search panel (F15): Ctrl+F, name search (instant, debounced 150ms), content search (ripgrep) |
| M6-F8 | Search visual feedback: matched objects glow (HighlightLayer), non-matched dim to 30% opacity |
| M6-F9 | Click search result → camera flies to object |
| M6-F10 | Lazy loading: deep subdirectories load on-demand when parent folder is opened |
| M6-F11 | Memory usage profiling + optimization for 5000-file target |

#### Entry State
M5 exit: fully interactive 3D workspace, but objects placed at default/random positions, no search.

#### Exit State
Objects are intelligently arranged: folders cluster with children, spacing prevents label overlap. Search works for both filenames and content. 5000-file workspaces perform within memory and framerate targets. Lazy loading enables handling of massive directories.

#### User Flows Testable After
- **UF7** (full): search by name + content, highlight, fly-to.
- **UF1** (enhanced): initial layout is pleasant, not random.
- **UF12** (enhanced): new files from git checkout get positioned via incremental layout.

#### Interaction Risks
- d3-force positions are 2D (XZ plane). Y position is determined by physics (objects rest on ground or on folder containers). Must ensure layout doesn't place objects inside folder containers they don't belong to.
- Worker communication latency: layout calculation results arrive asynchronously. Must handle case where user is dragging while layout is running.
- ripgrep binary must be correctly located in production build (path differs between dev and packaged app).

---

### M7 — Agent Core: BDI Architecture + OpenCode SDK

**FEATURES:** F17, F22, F23
**COMPLEXITY:** Large
**DURATION ESTIMATE:** ~6 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M7-F1 | OpenCode SDK integration in main process: `createOpencode()`, server health monitoring |
| M7-F2 | BDI engine in renderer: belief update loop, desire evaluation, intention selection, plan execution |
| M7-F3 | Seed beliefs: file_count, folder_depth, last_modified_files, clutter_level |
| M7-F4 | Seed desires: organize_workspace (priority 5), assist_user (priority 8), learn_preferences (priority 3) |
| M7-F5 | BDI loop on configurable interval (default 30s), pausable via settings/button |
| M7-F6 | AgentCapability interface + built-in capabilities: organize, search, create, move |
| M7-F7 | Agent 3D avatar: loaded .glb model, idle/thinking/acting state animations |
| M7-F8 | Animated agent actions (F22): walk to target, pick up, carry, place, search scan |
| M7-F9 | Action queue: sequential execution, cancellable, configurable speed (0.5x-instant) |
| M7-F10 | Action logging (F23): every action logged to `agent_action_log` with belief snapshot |
| M7-F11 | Agent state persistence: BDI state + avatar position saved to DB, restored on launch |
| M7-F12 | Agent pause/resume: avatar enters idle animation, BDI loop stops |

#### Entry State
M6 exit: fully interactive + laid-out + searchable workspace with no agent.

#### Exit State
An animated avatar appears in the scene. The agent has a working BDI loop that observes workspace state, forms intentions, and executes them (e.g., detects clutter, proposes organization). Agent actions are animated and logged. Agent can be paused/resumed. All agent state persists across sessions.

#### User Flows Testable After
- **UF9** (full): agent autonomous behavior — detects clutter → proposes organization.
- **UF8** (partial): agent can execute organize/search/move capabilities, but chat interface is M8.

#### Interaction Risks
- OpenCode SDK server startup may take several seconds. Agent features must gracefully degrade during startup.
- Agent file operations use the same operation queue as user operations (M5). Agent must respect the queue and not starve user actions.
- Avatar animation + physics interaction: avatar should push small objects aside but not be thrown by physics. Needs separate kinematic collider.
- BDI loop LLM calls add network latency. Must not block render thread. Entire BDI cycle runs asynchronously.

---

### M8 — Agent Features: Chat, Learning, Thought Visualization, LLM Config

**FEATURES:** F18, F19, F20, F21
**COMPLEXITY:** Large
**DURATION ESTIMATE:** ~6 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M8-F1 | Chat panel (F18): bottom-bar input, message history, speech bubbles over avatar |
| M8-F2 | User→agent task requests: "organize by type", "find latest report", natural language |
| M8-F3 | Agent creates OpenCode session per task, sends prompt with workspace context |
| M8-F4 | Agent parses LLM response to determine file operations → executes via capabilities |
| M8-F5 | Agent provides feedback in chat + speech bubble: progress, results, errors |
| M8-F6 | Learning system (F19): explicit teaching ("When I say X, do Y") + auto-learn proposals |
| M8-F7 | Instruction storage: trigger_pattern, action_description, embedding vector, confidence, usage_count |
| M8-F8 | Semantic trigger matching: embedding generation via configured API → cosine similarity ≥ 0.85 |
| M8-F9 | Memory management panel: view, edit, delete learned instructions |
| M8-F10 | Instruction eviction: 0 usage after 30 days flagged, max 1000 instructions |
| M8-F11 | Agent Mind panel (F20): beliefs, desires, current intention, action log, status indicator |
| M8-F12 | LLM config (F21): settings fields for LLM URL/key/model + embeddings URL/key/model |
| M8-F13 | API key encryption via `safeStorage` → stored encrypted in Turso |
| M8-F14 | "Test Connection" button for LLM endpoint |
| M8-F15 | Degraded mode: agent pauses if LLM unreachable, falls back to exact-match instructions |
| M8-F16 | Chat history persistence in DB |

#### Entry State
M7 exit: agent with BDI loop, avatar, animated actions, logging — but no user-facing communication or learning.

#### Exit State
Full agent interaction: users chat with the agent, give it tasks, teach it patterns, inspect its mind. LLM configuration is flexible (any OpenAI-compatible endpoint). Learning system uses semantic embeddings for trigger matching. All agent features are observable and configurable.

#### User Flows Testable After
- **UF8** (full): ask agent to organize → agent acts → reports results.
- **UF9** (full): autonomous behavior + user interaction ("not now" backs off).
- **UF10** (full): teach agent → later trigger → learned action executes.
- **UF11** (partial): LLM configuration and testing.

#### Interaction Risks
- **Embedding model change**: triggers full re-embedding of all instructions in background. Must show progress indicator and not block agent while running.
- **LLM response parsing**: LLM output is non-deterministic. Must use structured output parsing (JSON mode if supported, or robust regex extraction) with fallback to "I didn't understand that output."
- **Concurrent chat + autonomous action**: agent might be autonomously organizing while user sends a task. Action queue handles ordering, but chat UX must clearly show both streams.

---

### M9 — Settings Panel + Polish + Final Integration

**FEATURES:** F25, F26 (completion), F14 (shortcut customization), remaining edge cases
**COMPLEXITY:** Medium
**DURATION ESTIMATE:** ~5 days

#### Features Delivered

| ID | Description |
|----|-------------|
| M9-F1 | Full settings panel (F25): General, Camera, Keyboard, Agent, AI, Performance, Data tabs |
| M9-F2 | All settings auto-persist, sane defaults, "Reset to Defaults" per section and globally |
| M9-F3 | Settings export/import as JSON |
| M9-F4 | Keyboard shortcut customization (F14): remap all shortcuts, conflict detection |
| M9-F5 | Reduced motion mode: all animations instant, no physics visualization |
| M9-F6 | Theme support (light/dark) with CSS variables |
| M9-F7 | Action log export as JSON (Agent → Export Action Log) |
| M9-F8 | 90-day action log pruning on startup |
| M9-F9 | Data export/import: full DB dump + restore |
| M9-F10 | Application menu bar (File, View, Agent, Help) |
| M9-F11 | Error recovery: WebGL context loss, IPC timeout handling, unhandled exception recovery |
| M9-F12 | Logging system: app.log and error.log with rotation, configurable log levels |
| M9-F13 | Accessibility baseline: keyboard navigation, ARIA labels, color contrast, font scaling |
| M9-F14 | Final integration testing of all user flows UF1-UF12 |
| M9-F15 | Electron packaging with electron-forge: platform-specific builds, code signing |

#### Entry State
M8 exit: all features functional, but settings are minimal, edge cases are unhandled, packaging is dev-only.

#### Exit State
Production-ready v1.0. All settings are configurable. Edge cases are handled gracefully. Error recovery prevents crashes. Accessibility baseline is met. App packages for Windows, macOS, Linux. All 12 user flows pass.

#### User Flows Testable After
- **UF11** (full): settings panel with all tabs, all changes persist, import/export.
- **All UFs re-validated**: full regression pass.

#### Interaction Risks
- Settings changes must be immediately reflected everywhere. Changing theme must update both Solid.js CSS and Babylon.js materials. Changing physics quality must adjust Havok parameters at runtime.
- Packaging: bundled binaries (Havok WASM, ripgrep) must be included at correct paths for each platform. Forge config must account for native dependencies.
- Comprehensive error handling touches every module — risk of introducing regressions.

---

## PART C: CROSS-MILESTONE DEPENDENCY MAP

### Milestone Dependency DAG

```
M1 ─→ M2 ─→ M3 ─→ M4 ─→ M5 ─→ M6 ─→ M7 ─→ M8 ─→ M9
                              │                   │
                              └───────────────────→│
                              (M4 physics needed    (M8 depends on
                               by M5 interaction)    M6 search for
                                                     agent search capability)
```

All milestones are strictly sequential. Each depends on the prior milestone's exit state.

### Feature → Milestone Mapping

| Feature | Milestone | Depends On |
|---------|-----------|------------|
| F1 Dir Select | **M2** | M1 (Electron shell, IPC, DB) |
| F2 FS Mirror | **M3** | M2 (DB for scene_objects, signals for file-tree) |
| F3 FS Watch | **M3** | M2 (DB, signals), M1 (IPC for event push) |
| F4 Move/Grab/Throw | **M5** | M4 (physics), M3 (mesh creation) |
| F5 Open Files | **M5** | M3 (objects exist), M1 (IPC for shell.openPath) |
| F6 Create | **M5** | M3 (watcher creates objects), M2 (DB) |
| F7 Rename | **M5** | M3 (watcher updates labels), M2 (DB) |
| F8 Move (Drag) | **M5** | M4 (physics for drag), M3 (watcher for path update) |
| F9 Delete | **M5** | M3 (watcher removes objects), M1 (IPC for shell.trashItem) |
| F10 Metadata | **M5** | M3 (objects to hover over), M2 (signals for panel state) |
| F11 Layout | **M6** | M3 (objects to position), M2 (DB for position persistence) |
| F12 Physics | **M4** | M3 (meshes to attach bodies to), M1 (Babylon.js init) |
| F13 Camera | **M4** | M1 (Babylon.js canvas) |
| F14 Input/Shortcuts | **M5** (basic), **M9** (customization) | M4 (camera), M3 (objects to interact with) |
| F15 Search | **M6** | M3 (file tree to search), M5 (camera fly-to needs navigation), M1 (IPC for ripgrep) |
| F16 Lighting | **M4** | M1 (Babylon.js scene) |
| F17 Agent BDI | **M7** | M6 (workspace must be fully functional before agent acts), M2 (DB for agent state) |
| F18 Agent Chat | **M8** | M7 (BDI engine, avatar, actions) |
| F19 Agent Learning | **M8** | M7 (agent core), M2 (DB for instructions) |
| F20 Agent Thought Panel | **M8** | M7 (BDI state signals) |
| F21 AI Config | **M8** | M7 (OpenCode SDK integration), M2 (DB for encrypted key storage) |
| F22 Agent Animation | **M7** | M4 (Babylon.js animations, physics for avatar), M3 (meshes to interact with) |
| F23 Agent Logging | **M7** | M2 (DB for action_log) |
| F24 State Mgmt | **M2** | M1 (Solid.js installed) |
| F25 Settings | **M9** | M2 (DB), all other milestones (settings control every feature) |
| F26 Modular Arch | **M1** (initial), **M9** (polish) | — |
| F27 Performance | **M4** (LOD/instancing), **M6** (complete: lazy load, memory profiling) | M3 (many objects to optimize) |
| F28 Context Menu | **M5** | M3 (objects to right-click) |

### User Flow → Milestone Verification Matrix

This shows which milestones must be complete before each user flow is testable, and which milestones, when modified, require regression testing of that flow.

| User Flow | First Testable | Must Re-Test After |
|-----------|---------------|-------------------|
| **UF1** First Launch | **M2** (partial) → **M3** (full) | M2, M3, M4 (visual), M6 (layout), M9 (settings) |
| **UF2** Resume Session | **M2** (partial) → **M3** (full) | M2, M3, M4 (camera restore), M7 (agent restore) |
| **UF3** Browse & Navigate | **M4** (full) | M4, M5 (tooltips/metadata), M6 (layout quality) |
| **UF4** Move File | **M5** (full) | M3 (watcher), M4 (physics), M5, M6 (layout after move) |
| **UF5** Create File | **M5** (full) | M3 (watcher), M5, M6 (layout for new object) |
| **UF6** Delete File | **M5** (full) | M3 (watcher), M5 |
| **UF7** Search | **M6** (full) | M3 (file tree), M5 (camera fly-to), M6 |
| **UF8** Agent Organize | **M8** (full) | M3, M5, M6, M7, M8 |
| **UF9** Agent Autonomous | **M7** (partial) → **M8** (full) | M7, M8, M9 (agent settings) |
| **UF10** Teach Agent | **M8** (full) | M7, M8 |
| **UF11** Settings | **M9** (full) | M2 (DB), M8 (AI config), M9 |
| **UF12** External Changes | **M3** (full) | M3, M4 (visual), M5 (watcher integration), M6 (layout) |

### Regression Testing Matrix

After completing each milestone, the following user flows must be re-tested to ensure no regressions:

| Completed Milestone | Re-Test User Flows |
|--------------------|-------------------|
| **M1** | — (nothing testable yet) |
| **M2** | UF1 (partial) |
| **M3** | UF1, UF2, UF12 |
| **M4** | UF1, UF2, UF3, UF12 |
| **M5** | UF1, UF2, UF3, UF4, UF5, UF6, UF12 |
| **M6** | UF1, UF2, UF3, UF7, UF12 |
| **M7** | UF1, UF2, UF9 |
| **M8** | UF8, UF9, UF10, UF11 (partial) |
| **M9** | **ALL** (final integration pass) |

### Critical Path Components

These components are touched by the most milestones and represent the highest coupling risk. Changes to them require the broadest regression testing:

| Component | Milestones | Risk Level |
|-----------|-----------|------------|
| `state/` (Solid.js signals) | M2, M3, M4, M5, M6, M7, M8, M9 | **CRITICAL** — Central nervous system. Schema changes cascade to all consumers. Define signal shapes in M2 and resist changes. |
| `shared/ipc-api.ts` | M1, M2, M3, M5, M6, M7, M8 | **HIGH** — Adding channels is safe. Changing existing channel signatures breaks all callers. New channels per milestone; never modify existing ones. |
| `main/db/schema.ts` | M2, M7, M8 | **HIGH** — Schema changes require migrations. Design tables in M2 with all columns from the spec, even if unused until later milestones. |
| `renderer/engine/scene-bridge.ts` | M3, M4, M5, M6, M7 | **HIGH** — Translates every signal change into Babylon.js scene mutations. Must be extended per milestone but never rewritten. |
| `main/fs/watcher.ts` | M3, M5 | **MEDIUM** — M5 adds internal-operation tagging. Must not break M3 external event detection. |
| `renderer/engine/interaction.ts` | M5, M7 | **MEDIUM** — M7 adds agent interaction alongside user interaction. Input state machine must accommodate both. |

---

*End of architecture document.*
