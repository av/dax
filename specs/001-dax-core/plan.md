# Implementation Plan: Dax Core Platform

**Branch**: `001-dax-core` | **Date**: 2024-12-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-dax-core/spec.md`

## Summary

Dax is a Tauri-based desktop application presenting a 3D spatial interface for human-AI collaboration. Users interact with files and data as physical objects on a plane, while an autonomous AI agent navigates the space, sets goals, and assists with tasks. The technical approach combines Rust (Tauri backend, performance-critical systems) with a TypeScript/WebGL frontend for 3D rendering, physics, and UI.

## Technical Context

**Language/Version**: Rust 1.75+ (backend), TypeScript 5.3+ (frontend)
**Primary Dependencies**: Tauri 2.x, Three.js (3D rendering), Rapier (physics via WASM), React 18 (UI)
**Storage**: SQLite (workspace persistence), local filesystem (files)
**Testing**: Vitest (frontend), cargo test (Rust), Playwright (E2E)
**Target Platform**: Desktop - Windows 10+, macOS 12+, Linux (X11/Wayland)
**Project Type**: Desktop application with Tauri (Rust backend + web frontend)
**Performance Goals**: 60 FPS with 100+ objects, <500ms file import, <16ms input latency
**Constraints**: <500MB memory baseline, offline-capable core features, sandbox isolation
**Scale/Scope**: Single-user desktop app, workspaces with 1000+ objects, multi-hour sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Smart Concise Code | 3D engine code will be performance-critical; must avoid abstraction bloat | ✅ Pass |
| II. Maintainability | Clear separation: Tauri commands / 3D engine / UI / Agent system | ✅ Pass |
| III. Exceptional UX | Core value proposition is UX innovation; must be responsive and intuitive | ✅ Pass |
| IV. Performance First | 60 FPS target with physics is demanding; must architect for it | ✅ Pass |
| V. Test-First | Contract tests for Tauri commands, visual regression for 3D, E2E for workflows | ✅ Pass |

**Complexity Budget Check**:
- Cyclomatic complexity: Physics and agent decision systems may be complex—will modularize
- File size: 3D scene management may exceed 300 lines—justified by cohesion
- Dependencies: Three.js + Rapier + React is heavy but industry standard for this use case

## Project Structure

### Documentation (this feature)

```text
specs/001-dax-core/
├── spec.md              # Feature specification (created)
├── plan.md              # This file
├── research.md          # Phase 0 output (technology validation)
├── data-model.md        # Phase 1 output (entity schemas)
├── quickstart.md        # Phase 1 output (dev setup)
├── contracts/           # Phase 1 output (API contracts)
│   ├── tauri-commands.md
│   ├── scene-events.md
│   └── agent-protocol.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src-tauri/                    # Rust backend (Tauri)
├── src/
│   ├── main.rs               # Tauri entry point
│   ├── commands/             # Tauri command handlers
│   │   ├── mod.rs
│   │   ├── files.rs          # File operations
│   │   ├── workspace.rs      # Persistence
│   │   └── sandbox.rs        # Code execution
│   ├── models/               # Rust domain models
│   │   ├── mod.rs
│   │   ├── workspace.rs
│   │   └── file_object.rs
│   ├── sandbox/              # Sandboxed execution engine
│   │   ├── mod.rs
│   │   ├── runtime.rs
│   │   └── security.rs
│   └── persistence/          # SQLite operations
│       ├── mod.rs
│       └── schema.rs
├── Cargo.toml
└── tauri.conf.json

src/                          # TypeScript frontend
├── main.tsx                  # React entry point
├── App.tsx                   # Root component
├── engine/                   # 3D engine (Three.js + Rapier)
│   ├── index.ts
│   ├── Scene.ts              # Scene management
│   ├── Camera.ts             # RTS camera controller
│   ├── Physics.ts            # Rapier physics world
│   ├── ObjectManager.ts      # DataObject lifecycle
│   └── InputController.ts    # Mouse/keyboard handling
├── objects/                  # 3D object types
│   ├── DataObject.ts         # Base class
│   ├── FileObject.ts         # File representation
│   ├── Snippet.ts            # Data snippet
│   ├── Boundary.ts           # Zone boundary
│   ├── Beacon.ts             # Behavior beacon
│   └── AgentAvatar.ts        # Agent 3D representation
├── agent/                    # Agent system
│   ├── index.ts
│   ├── Agent.ts              # Agent state machine
│   ├── Goals.ts              # Goal management
│   ├── Pathfinding.ts        # Navigation
│   └── LLMBridge.ts          # LLM API integration
├── ui/                       # React UI components
│   ├── components/
│   │   ├── Viewport.tsx      # 3D canvas container
│   │   ├── ChatPanel.tsx     # Agent chat interface
│   │   ├── GoalsPanel.tsx    # Goal list
│   │   ├── EditorPanel.tsx   # Text editor
│   │   ├── SandboxPanel.tsx  # Code execution
│   │   └── Toolbar.tsx       # Tool selection
│   ├── hooks/
│   │   ├── useScene.ts
│   │   ├── useAgent.ts
│   │   └── useWorkspace.ts
│   └── stores/               # State management (Zustand)
│       ├── sceneStore.ts
│       ├── agentStore.ts
│       └── workspaceStore.ts
├── services/                 # Frontend services
│   ├── tauri.ts              # Tauri command wrappers
│   ├── fileTypes.ts          # File type detection/icons
│   └── persistence.ts        # Workspace save/load
└── types/                    # TypeScript types
    ├── index.ts
    ├── objects.ts
    ├── agent.ts
    └── workspace.ts

tests/
├── e2e/                      # Playwright E2E tests
│   ├── file-import.spec.ts
│   ├── camera-controls.spec.ts
│   └── agent-interaction.spec.ts
├── integration/              # Integration tests
│   └── tauri-commands.spec.ts
└── unit/                     # Unit tests (colocated with src)

public/
├── assets/
│   ├── models/               # 3D models for objects
│   └── icons/                # File type icons
└── index.html
```

**Structure Decision**: Tauri desktop application with clear separation between Rust backend (file I/O, persistence, sandbox) and TypeScript frontend (3D rendering, UI, agent logic). Agent intelligence runs in frontend with LLM API calls; sandbox execution happens in Rust for security isolation.

## Key Technical Decisions

### 3D Engine: Three.js + Rapier

- Three.js for WebGL rendering (mature, well-documented, performant)
- Rapier.js (WASM) for physics (modern, fast, deterministic)
- Custom RTS camera implementation on top of Three.js OrbitControls concepts

### State Management: Zustand

- Lightweight, TypeScript-friendly
- Easy integration with React and imperative 3D code
- Persistence middleware for workspace state

### LLM Integration: Provider-Agnostic

- Abstract LLM interface supporting OpenAI, Anthropic, local models
- Configuration-driven provider selection
- Streaming responses for chat interaction

### Sandbox: Rust-based Isolation

- Deno-style permission system for file access
- Resource limits (CPU time, memory)
- Supports Python (via embedded interpreter) and JavaScript (via deno_core)

## Complexity Tracking

| Potential Violation | Mitigation |
|---------------------|------------|
| 3D engine file size | Split into focused modules (Scene, Camera, Physics, Objects) |
| Agent decision complexity | State machine pattern with clear transitions |
| Multiple state stores | Single source of truth per domain, clear boundaries |

## Research Questions (Phase 0)

1. **Rapier.js WASM performance**: Can we maintain 60 FPS with 100+ physics bodies?
2. **Tauri file drop API**: How to get drag-and-drop file data from OS?
3. **Embedded Python in Rust**: Feasibility of PyO3 for sandbox execution
4. **Three.js instancing**: Best approach for rendering many similar objects efficiently
5. **LLM streaming in Tauri**: Architecture for streaming responses through IPC

## Design Deliverables (Phase 1)

1. **data-model.md**: Complete entity schemas with TypeScript interfaces and Rust structs
2. **contracts/tauri-commands.md**: All Tauri command signatures and payloads
3. **contracts/scene-events.md**: Event system between engine and UI
4. **contracts/agent-protocol.md**: Agent message types and state transitions
5. **quickstart.md**: Development environment setup (Rust, Node, Tauri CLI)
