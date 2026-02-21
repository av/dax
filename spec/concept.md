# Project: Dax — 3D File Workspace with AI Agent

## Vision
An Electron desktop app that represents a local folder as an interactive 3D spatial workspace.
Files and folders are physical objects in a Three.js scene. An AI agent exists as a visible
entity in this space, autonomously performing file operations (reading, summarizing, organizing,
transforming) based on high-level user goals. The user steers; the agent executes.

## Tech Stack (strict)
- Electron (latest stable) with context-isolated renderer
- React 18+ for all UI (panels, overlays, HUD)
- Three.js via @react-three/fiber + @react-three/drei for the 3D scene
- TypeScript everywhere — strict mode, no `any`
- Zustand for global state management
- chokidar for filesystem watching
- Node.js `fs/promises` in the main process, exposed via typed IPC bridge

## Architecture

### Process Separation
- **Main process**: filesystem access, chokidar watcher, LLM API calls, native dialogs
- **Renderer process**: React app, Three.js scene, all UI
- **Preload script**: typed IPC bridge (`contextBridge.exposeInMainWorld`) — no `nodeIntegration`

### Data Flow
filesystem → main process → IPC → Zustand store → React/Three.js rendering
user action → React event → IPC → main process → filesystem / LLM API

### File Tree Model
```ts
interface FileNode {
  id: string;            // stable hash of absolute path
  name: string;
  path: string;          // absolute
  type: 'file' | 'directory';
  extension: string | null;
  sizeBytes: number;
  modifiedAt: number;    // unix ms
  children?: FileNode[]; // only for directories
  position: [number, number, number]; // 3D world coords
  metadata?: Record<string, unknown>; // agent-populated
}
```

## 3D Scene Design

### Spatial Layout
- Root folder opens as a ground plane. Subdirectories are elevated platforms/clusters.
- Files are 3D objects sitting on their parent directory's surface.
- Use an automatic force-directed or grid layout algorithm. User can drag objects to override.
- Camera: orbit controls by default, smooth animated transitions when focusing on a file/folder.

### File Object Representation
- Shape encodes type: box = document, sphere = image/media, cylinder = code, torus = archive
- Size encodes file size (logarithmic scale, clamped min/max)
- Color encodes extension group (e.g., blue = code, green = spreadsheet, orange = document)
- Hover: glow outline + floating label (name, size, modified date)
- Selection: lift + brighter emission + detail panel slides in from right

### Performance Requirements
- Use instanced meshes for file objects (InstancedMesh) — mandatory for folders with 1000+ files
- Implement frustum culling and LOD (distant files become simple billboards)
- Virtualize: only create detailed meshes for objects within camera's near/mid range
- Target: 60 fps with 10,000 file objects on mid-range hardware
- Lazy-load directory contents — only expand when user navigates into a subdirectory or the agent needs access
- Debounce filesystem watcher events (300ms) before updating the store

## Agent System

### Visual Presence
- The agent is a distinct animated entity in the scene (a small hovering geometric form — e.g., an icosahedron with a subtle pulsing glow)
- When idle: gently orbits near the user's camera focus
- When working: physically flies to the file/folder it's operating on, with a visible particle trail
- Status is shown via color shifts: idle = soft blue, thinking = amber pulse, acting = green, error = red

### Agent Capabilities
The agent operates through a tool-use loop. It receives the user's high-level goal plus the
current file tree state, then decides which tool calls to make.

Available tools:
- `readFile(path)` — returns file content (text) or metadata (binary)
- `writeFile(path, content)` — create or overwrite
- `moveFile(src, dest)`
- `deleteFile(path)` — moves to OS trash
- `renameFile(path, newName)`
- `listDirectory(path)`
- `summarizeFile(path)` — reads and produces a summary stored in metadata
- `searchFiles(query)` — semantic or keyword search across loaded tree
- `suggestActions()` — proposes next steps to the user for approval

### Agent Interaction Model
1. User types a high-level goal in the command bar (e.g., "Organize this project by topic",
   "Summarize all the reports in /quarterly", "Find duplicates")
2. Agent breaks the goal into a visible step-by-step plan displayed in a side panel
3. Each step requires user approval (click to approve individual step or "approve all")
4. Agent executes approved steps sequentially, animating its movement in the scene
5. Results appear as metadata badges on affected files and in the activity log

### LLM Configuration
- Settings panel where user provides: API endpoint URL, API key, model name
- Support OpenAI-compatible API format (covers OpenAI, Anthropic via proxy,
  local servers like Ollama/LM Studio/vLLM)
- Configurable: temperature, max tokens, system prompt override
- Connection test button that validates the config before saving
- Persist config in `electron-store`, encrypted at rest for the API key

## UI Layers

### HUD Overlay (React, rendered on top of Three.js canvas)
- **Top bar**: project name, breadcrumb path, search input
- **Command bar** (Cmd+K / Ctrl+K): natural language input for agent goals
- **Right panel** (collapsible): file detail view, agent plan/activity log
- **Bottom bar**: status (file count, agent state), performance stats in dev mode
- **Minimap**: small 2D top-down view of the scene in bottom-left corner

### Onboarding Flow
1. App opens to a single centered button: "Open a Folder"
2. After folder selection, files animate into the scene one by one (staggered, 20ms per object, max 2s total)
3. Agent entity spawns with a brief intro tooltip: "I'm your workspace agent. Tell me what to do."
4. Command bar pulses gently with placeholder: "Try: 'Summarize the largest files'"
5. First successful agent action triggers a subtle toast: "You can approve, edit, or reject any step."

### Keyboard & Mouse
- Left click: select file → detail panel
- Double click: open file in system default app (`shell.openPath`)
- Right click: context menu (open, rename, move, delete, ask agent about this file)
- Middle mouse drag: pan camera
- Scroll: zoom
- Cmd/Ctrl+K: command bar
- Escape: deselect / close panels
- Multi-select: Shift+click or drag-box selection
- Bulk actions toolbar appears when multi-selected

## File Format Support
- **Preview in detail panel** (not full editor):
  - Text/code: syntax-highlighted first 200 lines (use shiki)
  - Markdown: rendered HTML
  - Images: thumbnail (png, jpg, gif, webp, svg)
  - PDF: first page rendered via pdf.js
  - CSV: table view of first 100 rows
- All other file types: show icon, metadata, and "Open externally" button
- Do NOT build a full office suite. The value is spatial organization + agent intelligence,
  not file editing.

## Project Structure
```
orbiter/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   │   ├── filesystem.ts
│   │   ├── llm.ts
│   │   └── shell.ts
│   └── services/
│       ├── fileWatcher.ts
│       └── llmClient.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── stores/
│   │   ├── fileTreeStore.ts
│   │   ├── agentStore.ts
│   │   ├── selectionStore.ts
│   │   └── settingsStore.ts
│   ├── scene/
│   │   ├── Workspace.tsx          # root Three.js scene
│   │   ├── FileObject.tsx         # single file mesh
│   │   ├── FileInstances.tsx      # instanced rendering
│   │   ├── DirectoryPlatform.tsx
│   │   ├── AgentEntity.tsx
│   │   ├── CameraController.tsx
│   │   └── layout/
│   │       └── spatialLayout.ts   # positioning algorithm
│   ├── ui/
│   │   ├── HUD.tsx
│   │   ├── CommandBar.tsx
│   │   ├── DetailPanel.tsx
│   │   ├── AgentPlanPanel.tsx
│   │   ├── Minimap.tsx
│   │   ├── ContextMenu.tsx
│   │   ├── Onboarding.tsx
│   │   └── Settings.tsx
│   ├── agent/
│   │   ├── planner.ts             # goal → step breakdown
│   │   ├── executor.ts            # step → tool call
│   │   ├── tools.ts               # tool definitions
│   │   └── prompts.ts             # system prompts for the LLM
│   ├── hooks/
│   └── utils/
├── package.json
├── tsconfig.json
├── electron-builder.yml
└── vite.config.ts                 # use vite for renderer bundling
```

## Build & Dev Tooling
- Vite for renderer bundling
- electron-builder for packaging
- `npm run dev` — starts both vite dev server and electron in watch mode
- `npm run build` — production build
- `npm run package` — creates distributable for current platform

## Implementation Phases
Build in this order. Each phase must be fully working before starting the next.

1. **Scaffold** — Electron + Vite + React + TypeScript skeleton. Window opens, renders a React component.
2. **Filesystem** — Folder picker, recursive directory read, chokidar watcher, IPC bridge, Zustand file tree store.
3. **3D Scene** — @react-three/fiber canvas, file objects rendered from store, camera controls, spatial layout algorithm, instanced rendering.
4. **Selection & Interaction** — Click/hover/multi-select, detail panel, context menu, open externally.
5. **Agent Visual** — Agent entity in scene, animation states, movement to targets.
6. **LLM Integration** — Settings panel, LLM client in main process, connection test.
7. **Agent Intelligence** — Tool definitions, planner, executor, plan approval UI, activity log.
8. **File Previews** — Syntax highlighting, markdown render, image thumbnails, PDF first page, CSV table.
9. **Onboarding** — First-launch flow, animated entrance, tooltips.
10. **Polish** — Performance profiling, LOD tuning, transition animations, error handling, edge cases.
