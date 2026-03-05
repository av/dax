# DAX

Desktop app that mirrors a filesystem as 3D objects in a physics-based environment with an autonomous AI agent.

## Tech Stack

- **Desktop Shell:** Electron (electron-forge)
- **Build Tool:** Vite
- **UI Framework:** Solid.js
- **3D Engine:** Babylon.js
- **Language:** TypeScript
- **Testing:** Vitest
- **Linting:** ESLint + Prettier

## Prerequisites

- Node.js >= 20
- npm >= 10

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd dax

# Install dependencies
npm install
```

## Development

```bash
# Start the app with hot module reloading
npm run dev
```

This launches the Electron app with a Vite dev server for the renderer process. Changes to renderer code (Solid.js, Babylon.js) trigger HMR. Changes to main process code restart the Electron app.

## Build

```bash
# Package the app for distribution
npm run build

# Package without making installers
npm run package
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Code Quality

```bash
# Lint all source files
npm run lint

# Format all source files
npm run format

# Check formatting without writing
npm run format:check

# Type-check without emitting
npm run typecheck
```

## Project Structure

```
src/
├── main/           — Electron main process (Node.js context)
│   ├── index.ts    — App lifecycle, window creation
│   ├── window.ts   — BrowserWindow factory with security options
│   ├── ipc.ts      — IPC handler registration
│   ├── menu.ts     — Application menu
│   ├── agent/      — Agent LLM service (opencode integration)
│   ├── db/         — Turso DB layer (config, scene, agent, chat repos + migrations)
│   └── fs/         — Filesystem ops (scanner, watcher, search, validators)
│
├── preload/
│   └── index.ts    — contextBridge.exposeInMainWorld('dax', { ... })
│
├── renderer/       — Electron renderer process (browser context)
│   ├── index.html  — HTML shell with canvas + app div
│   ├── index.tsx   — Entry: mounts Solid.js + initializes Babylon.js
│   ├── global.css  — CSS reset + variables
│   ├── agent/      — BDI engine, beliefs, desires, intentions, capabilities, learning
│   ├── core/       — IPC client, bootstrap, keyboard shortcuts
│   ├── db/         — Database types
│   ├── engine/     — Babylon.js scene, camera, lighting, physics, mesh factory, selection
│   ├── fs/         — Filesystem service (IPC wrappers)
│   ├── gui/        — Solid.js UI: panels (Welcome, Chat, Search, Settings, Metadata, AgentMind) + overlays
│   ├── layout/     — d3-force layout service + Web Worker
│   └── state/      — Solid.js signal stores (file-tree, selection, camera, agent, config, UI)
│
├── shared/         — Shared types (no runtime deps)
│   ├── ipc-api.ts  — IPC channel type map
│   ├── file-types.ts — FileEntry, FileCategory, etc.
│   ├── constants.ts  — App constants
│   ├── errors.ts     — Error types
│   └── events.ts     — Event types
│
└── test/           — Vitest test suites (mirrors src/ structure)
```

## Architecture

The app follows a strict process separation:

- **Main process** (`src/main/`): Node.js context. Handles filesystem, database, system APIs.
- **Preload** (`src/preload/`): Bridge between main and renderer. Exposes typed API via `contextBridge`.
- **Renderer** (`src/renderer/`): Browser context. Runs Babylon.js 3D engine + Solid.js UI.
- **Shared** (`src/shared/`): Pure TypeScript types and constants. No runtime dependencies.

Security: `contextIsolation: true`, `nodeIntegration: false`. The renderer has no direct access to Node.js APIs.

## License

MIT
