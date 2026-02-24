# Dax

A desktop app that renders a local folder as an interactive **3D spatial workspace** with an AI agent. Built with Electron, React, React Three Fiber, and Three.js.

## Prerequisites

- **Node.js 22+** (run `node --version` to check)
- A local folder to explore — you'll be prompted to open one when the app launches

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts Vite on `http://localhost:5173` and launches Electron with `--remote-debugging-port=9222`. **Port 5173 must be free.**

> **Physics debug wireframes** are visible in dev mode. The physics engine ([Rapier](https://rapier.rs/) via `@react-three/rapier`) draws collider outlines around every object when `NODE_ENV` is `development` — this is expected and intentional.

## Build

```bash
npm run build        # Compile renderer → dist-renderer/ and main process → dist-electron/
npm run package      # Full distributable via electron-builder (runs build first)
```

## Type Check

```bash
npm run typecheck    # tsc --noEmit for both src/ and electron/
```

## Usage

On first launch you will be prompted to **open a local folder**. Dax watches the folder for changes (via chokidar) and renders each file as a 3D object in the scene. You can:

- Click / shift-click to select files
- Drag files to move them
- Double-click a file to open it externally
- Right-click for a context menu
- Use the AI agent panel to ask questions about your workspace

## LLM / AI Agent

The agent requires an LLM endpoint. Configure it under **Settings** (endpoint URL, API key, model name). The planner calls the LLM to produce a step-by-step plan; the executor walks the 3D scene and runs each step with a 600 ms delay for visual feedback.

## Architecture Overview

```
electron/          Main process — IPC handlers, file watcher, LLM client, settings
src/
  agent/           Planner, executor, tools
  scene/           React Three Fiber scene, physics, instanced rendering
  stores/          Zustand stores (fileTree, selection, agent, settings)
  ui/              HUD overlays (pure inline styles, no CSS files)
  types/index.ts   Shared types imported everywhere as @/types
```

See [`AGENTS.md`](./AGENTS.md) for full contributor guidelines.
