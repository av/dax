# Dax — Project Guidelines

## Architecture

Dax is an **Electron + React + Three.js** desktop app that renders a local folder as an interactive 3D spatial workspace with an AI agent. Three layers:

- **`electron/`** — main process: IPC handlers (`ipc/`), persistent services (`services/`)
- **`src/`** — renderer: React UI (`ui/`), R3F scene (`scene/`), Zustand stores (`stores/`), agent logic (`agent/`)
- Types shared via `src/types/index.ts` (imported everywhere as `@/types`)

## Build and Dev

```bash
npm install
npm run dev          # Vite + Electron concurrently (requires port 5173 free)
npm run build        # Production build → dist-renderer/ + dist-electron/
npm run typecheck    # tsc --noEmit for both src and electron
npm run package      # Build + electron-builder distributable
```

Dev launches Vite on `http://localhost:5173` with `--remote-debugging-port=9222`.

## Code Style

- **TypeScript strict mode** — no `any`; use `unknown` + type-narrowing (`instanceof Error`)
- Section dividers: `// ── Section Name ──────────────────────────`
- `export default function ComponentName()` for React components
- `@/` alias resolves to `src/` (e.g. `@/types`, `@/stores/agentStore`)
- Electron source (`electron/`) imports shared types as `../../src/types/index`

## IPC Pattern

Channels follow `namespace:action` (e.g. `fs:readDirectory`, `llm:sendMessage`, `settings:save`).

- **Main**: `ipcMain.handle('ns:action', handler)` — registered in `registerXxxHandlers()`
- **Preload**: wraps every channel as `ipcRenderer.invoke(...)` on a single `api: DaxAPI` object exposed via `contextBridge.exposeInMainWorld('electronAPI', api)`
- **Renderer**: `window.electronAPI.methodName()` — all methods are `async`, returning `Promise<T>`
- Push events (e.g. file-change): main sends `win.webContents.send('fs:fileChange', event)`; preload exposes `onFileChange(cb)` returning an unsubscribe function

See [`electron/preload.ts`](../electron/preload.ts) and [`electron/ipc/filesystem.ts`](../electron/ipc/filesystem.ts).

## Zustand Stores

- Structure: `create<State>((set, get) => ...)` with types and initial state defined at top of file
- `fileTreeStore` uses `Map<string, FileNode>` (not arrays) for O(1) node lookup by id; `rootChildren: string[]` holds ordered root IDs
- Access stores outside React (e.g. in agent tools): `useXxxStore.getState()`
- Inside event handlers use `.getState()` to avoid stale closures

See [`src/stores/`](../src/stores/).

## UI / Styling

- **Inline styles only** — no CSS files, no CSS-in-JS library; all values from the `theme` object in [`src/theme.ts`](../src/theme.ts)
- Warm off-white base (`#F7F5F2`), accent `#D46B4E`, semantic status and file-type colors
- All overlays composed through [`src/ui/HUD.tsx`](../src/ui/HUD.tsx)
- Zustand selectors: `useXxxStore((s) => s.field)` — avoid subscribing to full store

## Agent

- **Planner** (`src/agent/planner.ts`): calls LLM, parses JSON plan into `AgentStep[]`
- **Tools** (`src/agent/tools.ts`): `Tool` interface — `execute` always receives `Record<string, string>`; config injected via `setToolLLMConfig(config)`
- **Executor** (`src/agent/executor.ts`): moves the 3D agent entity to the target file before executing (`store.moveTo(node.position)`); never throws — resolves with `{ success: false, result: errorMessage }` on failure; 600 ms delay between steps for visual feedback
- `FileNode.id` is a 16-char hex SHA-256 of the absolute path

## Integration Points

- **LLM**: configured via `AppSettings.llm` (endpoint, key, model); `llmClient.ts` in main process, exposed via `llm:*` IPC
- **File watching**: `FileWatcherService` (chokidar) in main process; pushes `fs:fileChange` events to renderer
- **Settings**: persisted via `electron-store` (encrypted), accessed via `settings:get` / `settings:save`

## The working tree is the source of truth.

Git history, branch searches, and grep results are useful signals — but an empty result does not mean something doesn't exist. Code may be present on disk but uncommitted, on a different branch, or simply not indexed. Before concluding that a feature is absent or was removed, read the actual files on disk. Never treat "I couldn't find it in git" as equivalent to "it isn't there."

## Modifying files

When modifying any files, you exclusively use dedicated file editing commands, and never use general-purpose terminal commands.
You do not use cat or echo to write to files and you do not reset files to git state with git checkout or similar commands.