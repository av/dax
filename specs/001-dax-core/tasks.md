# Tasks: Dax Core Platform

**Input**: Design documents from `/specs/001-dax-core/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Not explicitly requested - tests omitted (add via TDD if needed later)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US11)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize Tauri project structure with frontend and backend scaffolding

- [X] T001 Create Tauri 2.x project with React frontend at repository root
- [X] T002 [P] Configure `src-tauri/Cargo.toml` with dependencies (serde, tokio, uuid, sqlx, notify)
- [X] T003 [P] Configure `package.json` with frontend dependencies (three, @dimforge/rapier3d, zustand, eventemitter3)
- [X] T004 [P] Setup TypeScript configuration in `tsconfig.json` with strict mode
- [X] T005 [P] Configure Vite bundler in `vite.config.ts` for Tauri
- [X] T006 [P] Configure ESLint and Prettier in `.eslintrc.cjs` and `.prettierrc`
- [X] T007 Create directory structure per plan.md: `src/engine/`, `src/objects/`, `src/agent/`, `src/ui/`, `src/services/`, `src/types/`
- [X] T008 [P] Create directory structure for Rust: `src-tauri/src/commands/`, `src-tauri/src/models/`, `src-tauri/src/persistence/`, `src-tauri/src/sandbox/`
- [X] T009 [P] Create `.env.example` with LLM configuration template

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### TypeScript Types & Interfaces

- [X] T010 [P] Create base types `Vector3`, `DataObject`, `DataObjectType` in `src/types/objects.ts`
- [X] T011 [P] Create `Workspace`, `CameraState`, `WorkspaceSettings` types in `src/types/workspace.ts`
- [X] T012 [P] Create `Agent`, `AgentState`, `AgentConfig`, `AgentPersonality` types in `src/types/agent.ts`
- [X] T013 [P] Create `Goal`, `GoalType`, `GoalStatus`, `GoalResult` types in `src/types/agent.ts`
- [X] T014 Create type index exporting all types in `src/types/index.ts`

### Rust Models

- [X] T015 [P] Create `Vector3` struct in `src-tauri/src/models/mod.rs`
- [X] T016 [P] Create `Workspace` struct with SQLite serialization in `src-tauri/src/models/workspace.rs`
- [X] T017 [P] Create `FileObject`, `FileCategory` structs in `src-tauri/src/models/file_object.rs`

### Event System

- [X] T018 Create scene event bus with TypeScript types per `scene-events.md` in `src/engine/events.ts`
- [X] T019 [P] Create Tauri event listeners wrapper in `src/services/tauri.ts`

### State Management

- [X] T020 Create base Zustand store setup in `src/ui/stores/index.ts`
- [X] T021 [P] Create `sceneStore` with object state management in `src/ui/stores/sceneStore.ts`
- [X] T022 [P] Create `workspaceStore` with persistence state in `src/ui/stores/workspaceStore.ts`
- [X] T023 [P] Create `agentStore` with agent state in `src/ui/stores/agentStore.ts`

### Persistence Layer

- [X] T024 Create SQLite schema per `data-model.md` in `src-tauri/src/persistence/schema.rs`
- [X] T025 Implement database initialization in `src-tauri/src/persistence/mod.rs`

### Tauri Entry Points

- [X] T026 Setup Tauri main entry with command registration in `src-tauri/src/main.rs`
- [X] T027 [P] Create commands module index in `src-tauri/src/commands/mod.rs`

### React App Shell

- [X] T028 Create React entry point in `src/main.tsx`
- [X] T029 Create root App component with layout in `src/App.tsx`
- [X] T030 [P] Create Viewport container component in `src/ui/components/Viewport.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 3D Data Plane Navigation (Priority: P1) 🎯 MVP

**Goal**: User sees 3D plane from top-down perspective with RTS-style camera controls (pan, zoom, rotate)

**Independent Test**: Launch app → empty plane renders with grid → camera responds to pan/zoom/rotate → 60 FPS maintained

### 3D Engine Core

- [X] T031 [US1] Create Three.js scene initialization in `src/engine/Scene.ts`
- [X] T032 [US1] Create ground plane with grid material in `src/engine/Scene.ts`
- [X] T033 [US1] Implement RTS camera controller with pan/zoom/rotate in `src/engine/Camera.ts`
- [X] T034 [US1] Create input controller for mouse/keyboard in `src/engine/InputController.ts`
- [X] T035 [US1] Implement render loop with FPS monitoring in `src/engine/index.ts`
- [X] T036 [US1] Integrate scene with Viewport component via `useScene` hook in `src/ui/hooks/useScene.ts`

### Physics Foundation

- [X] T038 [US1] Initialize Rapier WASM physics world in `src/engine/Physics.ts`
- [X] T039 [US1] Create physics ground plane collider in `src/engine/Physics.ts`
- [X] T040 [US1] Implement physics step integration with render loop in `src/engine/Physics.ts`

**Checkpoint**: User Story 1 complete - 3D plane navigation functional

---

## Phase 4: User Story 2 - File Import and Physical Representation (Priority: P1)

**Goal**: User drags files from OS to plane, files appear as 3D objects with physics

**Independent Test**: Drag file from desktop → drop on plane → object appears with correct visual → object settles with physics → metadata accessible on hover

### Tauri File Commands

- [X] T041 [P] [US2] Implement `get_file_metadata` command in `src-tauri/src/commands/files.rs`
- [X] T042 [P] [US2] Implement `read_file` command in `src-tauri/src/commands/files.rs`
- [X] T043 [P] [US2] Implement `generate_preview` command in `src-tauri/src/commands/files.rs`
- [X] T044 [US2] Register file commands in `src-tauri/src/commands/mod.rs`

### File Object System

- [X] T045 [US2] Create `FileObject` type extending `DataObject` in `src/types/objects.ts`
- [X] T046 [US2] Create file type detection/categorization service in `src/services/fileTypes.ts`
- [X] T047 [US2] Create `DataObject` base 3D class in `src/objects/DataObject.ts`
- [X] T048 [US2] Create `FileObject` 3D representation with category-based geometry in `src/objects/FileObject.ts`
- [X] T049 [US2] Create object manager for lifecycle (create, update, delete) in `src/engine/ObjectManager.ts`

### File Drop Handling

- [X] T050 [US2] Implement Tauri file-drop event listeners in `src/engine/InputController.ts`
- [X] T051 [US2] Create drop zone visual indicator in `src/engine/Scene.ts`
- [X] T052 [US2] Integrate file drop with object creation flow in `src/engine/ObjectManager.ts`

### Physics Integration for Objects

- [X] T053 [US2] Add rigid body creation for file objects in `src/engine/Physics.ts`
- [X] T054 [US2] Implement gravity and collision for spawned objects in `src/engine/Physics.ts`
- [X] T055 [US2] Implement physics sleeping for settled objects in `src/engine/Physics.ts`

### Object Hover/Tooltip

- [X] T056 [US2] Implement raycasting for object hover detection in `src/engine/InputController.ts`
- [X] T057 [US2] Create tooltip component for file info display in `src/ui/components/ObjectTooltip.tsx`

**Checkpoint**: User Story 2 complete - file import with physics working

---

## Phase 5: User Story 3 - Object Selection and Manipulation (Priority: P1)

**Goal**: User can select, drag, multi-select objects on the plane

**Independent Test**: Click object → highlights → drag to new position → release → object settles with physics

### Selection System

- [X] T058 [US3] Implement single-click selection in `src/engine/InputController.ts`
- [X] T059 [US3] Create selection highlight visual (glow/outline) in `src/objects/DataObject.ts`
- [X] T060 [US3] Implement box-selection (drag rectangle) in `src/engine/InputController.ts`
- [X] T061 [US3] Implement shift-click multi-select in `src/engine/InputController.ts`
- [X] T062 [US3] Add selection state to `sceneStore` in `src/ui/stores/sceneStore.ts`
- [X] T063 [US3] Emit selection events per `scene-events.md` in `src/engine/InputController.ts`

### Drag and Move

- [X] T064 [US3] Implement object drag initiation on selected objects in `src/engine/InputController.ts`
- [X] T065 [US3] Create drag plane constraint for object movement in `src/engine/InputController.ts`
- [X] T066 [US3] Implement drag preview (ghost position) in `src/objects/DataObject.ts`
- [X] T067 [US3] Apply physics impulse on drag release for settling in `src/engine/Physics.ts`

### Object Deletion

- [X] T068 [US3] Implement Delete key handler for selected objects in `src/engine/InputController.ts`
- [X] T069 [US3] Create confirmation dialog for file deletion in `src/ui/components/ConfirmDialog.tsx`
- [X] T070 [US3] Integrate object removal with ObjectManager in `src/engine/ObjectManager.ts`

**Checkpoint**: User Story 3 complete - full object manipulation working

---

## Phase 6: User Story 4 - Agent Presence and Movement (Priority: P2)

**Goal**: AI agent appears on plane as animated entity, moves purposefully toward objects

**Independent Test**: Agent spawns on plane → selects file to approach → moves with smooth animation → shows "focus" indicator

### Agent 3D Representation

- [X] T071 [US4] Create `AgentAvatar` 3D class with idle animation in `src/objects/AgentAvatar.ts`
- [X] T072 [US4] Implement agent spawn on plane in `src/engine/ObjectManager.ts`
- [X] T073 [US4] Add agent position sync with agentStore in `src/objects/AgentAvatar.ts`

### Agent State Machine

- [X] T074 [US4] Implement agent state machine per `agent-protocol.md` in `src/agent/Agent.ts`
- [X] T075 [US4] Create state transition handlers (idle, moving, analyzing, etc.) in `src/agent/Agent.ts`
- [X] T076 [US4] Emit state change events to agentStore in `src/agent/Agent.ts`

### Agent Movement

- [X] T077 [US4] Implement A* pathfinding around obstacles in `src/agent/Pathfinding.ts`
- [X] T078 [US4] Create smooth movement interpolation in `src/agent/Agent.ts`
- [X] T079 [US4] Implement path visualization (optional debug) in `src/objects/AgentAvatar.ts`

### Agent Focus Behavior

- [X] T080 [US4] Implement target selection logic in `src/agent/Agent.ts`
- [X] T081 [US4] Create "focus" animation when analyzing object in `src/objects/AgentAvatar.ts`
- [X] T082 [US4] Show "being analyzed" indicator on focused object in `src/objects/DataObject.ts`

### Agent UI

- [X] T083 [US4] Create agent hover tooltip (status, intention) in `src/ui/components/AgentTooltip.tsx`
- [X] T084 [US4] Create agent context panel for goals/activity log in `src/ui/components/AgentPanel.tsx`
- [X] T085 [US4] Connect agent panel to agentStore in `src/ui/hooks/useAgent.ts`

**Checkpoint**: User Story 4 complete - agent visible and moving

---

## Phase 7: User Story 5 - Agent Communication and Direction (Priority: P2)

**Goal**: User can chat with agent, ask questions, give commands, pause/resume

**Independent Test**: Open chat → ask "What are you doing?" → agent responds → give command → agent changes behavior

### Chat Interface

- [X] T086 [US5] Create chat panel component in `src/ui/components/ChatPanel.tsx`
- [X] T087 [US5] Implement chat message list with user/agent roles in `src/ui/components/ChatPanel.tsx`
- [X] T088 [US5] Create chat input with send button in `src/ui/components/ChatPanel.tsx`
- [X] T089 [US5] Add chat toggle hotkey handler in `src/engine/InputController.ts`

### LLM Integration

- [X] T090 [P] [US5] Implement `call_llm` command in `src-tauri/src/commands/llm.rs`
- [X] T091 [P] [US5] Implement `stream_llm` command with event emission in `src-tauri/src/commands/llm.rs`
- [X] T092 [US5] Create LLM bridge service in `src/agent/LLMBridge.ts`
- [X] T093 [US5] Implement system prompt builder per `agent-protocol.md` in `src/agent/LLMBridge.ts`
- [X] T094 [US5] Handle streaming responses in chat panel in `src/ui/components/ChatPanel.tsx`

### User Commands

- [X] T095 [US5] Implement natural language command parsing in `src/agent/Agent.ts`
- [X] T096 [US5] Implement "pause" command handler in `src/agent/Agent.ts`
- [X] T097 [US5] Implement "resume" command handler in `src/agent/Agent.ts`
- [X] T098 [US5] Implement "focus on this" command with context in `src/agent/Agent.ts`
- [X] T099 [US5] Add chat message history to workspace persistence in `src/ui/stores/workspaceStore.ts`

**Checkpoint**: User Story 5 complete - bidirectional agent communication working

---

## Phase 8: User Story 6 - Agent Autonomous Goals (Priority: P2)

**Goal**: Agent creates and pursues its own goals based on file analysis

**Independent Test**: Add related files → agent identifies relationship → creates goal → works toward it → progress visible

### Goal System

- [X] T100 [US6] Create goal manager in `src/agent/Goals.ts`
- [X] T101 [US6] Implement goal priority queue in `src/agent/Goals.ts`
- [X] T102 [US6] Implement goal creation from LLM analysis in `src/agent/Agent.ts`
- [X] T103 [US6] Add goal progress tracking in `src/agent/Goals.ts`

### Goals UI

- [X] T104 [US6] Create goals panel component in `src/ui/components/GoalsPanel.tsx`
- [X] T105 [US6] Display goal list with status/progress in `src/ui/components/GoalsPanel.tsx`
- [X] T106 [US6] Implement goal cancel/modify actions in `src/ui/components/GoalsPanel.tsx`
- [X] T107 [US6] Add user goal priority adjustment in `src/ui/components/GoalsPanel.tsx`

### Goal Execution

- [X] T108 [US6] Implement goal-to-action translation in `src/agent/Agent.ts`
- [X] T109 [US6] Create goal completion handling with result storage in `src/agent/Goals.ts`
- [X] T110 [US6] Add goal completion notifications in `src/ui/components/NotificationToast.tsx`

**Checkpoint**: User Story 6 complete - autonomous agent goals working

---

## Phase 9: User Story 9 - Text File Viewing and Editing (Priority: P2)

**Goal**: User can open text files in integrated editor with syntax highlighting

**Independent Test**: Double-click text file → editor opens → edit content → save → file on disk updated

### Editor Panel

- [X] T111 [US9] Create editor panel component in `src/ui/components/EditorPanel.tsx`
- [X] T112 [US9] Integrate Monaco editor or CodeMirror in `src/ui/components/EditorPanel.tsx`
- [X] T113 [US9] Add syntax highlighting for code files in `src/ui/components/EditorPanel.tsx`
- [X] T114 [US9] Implement markdown preview toggle in `src/ui/components/EditorPanel.tsx`

### File Operations

- [X] T115 [P] [US9] Implement `write_file` command in `src-tauri/src/commands/files.rs`
- [X] T116 [P] [US9] Implement `watch_file` command for external changes in `src-tauri/src/commands/files.rs`
- [X] T117 [US9] Create file watcher integration in frontend in `src/services/tauri.ts`
- [X] T118 [US9] Handle save (Ctrl+S) with Tauri write in `src/ui/components/EditorPanel.tsx`
- [X] T119 [US9] Implement unsaved changes prompt on close in `src/ui/components/EditorPanel.tsx`

### Editor Integration

- [X] T120 [US9] Connect double-click event to editor open in `src/App.tsx`
- [X] T121 [US9] Add "being edited" indicator on object in `src/App.tsx`
- [X] T122 [US9] Coordinate editor with agent analysis indicator in `src/ui/components/EditorPanel.tsx`

**Checkpoint**: User Story 9 complete - text editing functional

---

## Phase 10: User Story 7 - Boundaries and Zones (Priority: P3)

**Goal**: User draws boundary zones with instructions that affect agent behavior

**Independent Test**: Draw boundary → add instruction → drag files into boundary → agent respects instruction

### Boundary Types

- [X] T123 [US7] Create `Boundary` type with instructions in `src/types/objects.ts`
- [X] T124 [US7] Create `Boundary` 3D representation in `src/objects/Boundary.ts`
- [X] T125 [US7] Implement boundary polygon rendering in `src/objects/Boundary.ts`

### Boundary Drawing

- [X] T126 [US7] Create boundary drawing tool mode in `src/engine/InputController.ts`
- [X] T127 [US7] Implement polygon vertex placement in `src/engine/InputController.ts`
- [X] T128 [US7] Add boundary close/complete detection in `src/engine/InputController.ts`
- [X] T129 [US7] Create toolbar with boundary tool in `src/ui/components/Toolbar.tsx`

### Boundary Instructions

- [X] T130 [US7] Create instruction editor popup in `src/ui/components/BoundaryEditor.tsx`
- [X] T131 [US7] Implement boundary instruction types (organize, summarize, review, etc.) in `src/ui/components/BoundaryEditor.tsx`
- [X] T132 [US7] Store boundary instructions in sceneStore in `src/ui/stores/sceneStore.ts`

### Agent Boundary Integration

- [X] T133 [US7] Detect objects entering/exiting boundaries in `src/engine/Physics.ts`
- [X] T134 [US7] Emit boundary events per `scene-events.md` in `src/engine/events.ts`
- [X] T135 [US7] Apply boundary instructions in agent behavior in `src/agent/Agent.ts`
- [X] T136 [US7] Implement boundary resize via edge drag in `src/engine/InputController.ts`

**Checkpoint**: User Story 7 complete - boundaries affecting agent behavior

---

## Phase 11: User Story 8 - Beacons for Agent Behavior Modulation (Priority: P3)

**Goal**: User places beacons that influence agent behavior by proximity

**Independent Test**: Place "attract" beacon → agent prioritizes nearby objects → move beacon → priority changes

### Beacon Types

- [X] T137 [US8] Create `Beacon` type with radius/intensity in `src/types/objects.ts`
- [X] T138 [US8] Create `Beacon` 3D representation with range indicator in `src/objects/Beacon.ts`
- [X] T139 [US8] Implement beacon type visuals (attract, repel, speed, etc.) in `src/objects/Beacon.ts`

### Beacon Placement

- [X] T140 [US8] Create beacon placement tool in `src/engine/InputController.ts`
- [X] T141 [US8] Add beacon type selector popup in `src/ui/components/BeaconSelector.tsx`
- [X] T142 [US8] Add beacon tool to toolbar in `src/ui/components/Toolbar.tsx`
- [X] T143 [US8] Implement beacon radius adjustment slider in `src/ui/components/BeaconEditor.tsx`

### Agent Beacon Integration

- [X] T144 [US8] Calculate beacon influence on agent goal priority in `src/agent/Goals.ts`
- [X] T145 [US8] Implement attract beacon priority boost in `src/agent/Goals.ts`
- [X] T146 [US8] Implement repel beacon in pathfinding avoidance in `src/agent/Pathfinding.ts`
- [X] T147 [US8] Implement notify beacon user alerts in `src/ui/components/NotificationToast.tsx`
- [X] T148 [US8] Emit beacon range events per `scene-events.md` in `src/engine/events.ts`

**Checkpoint**: User Story 8 complete - beacons modulating agent behavior

---

## Phase 12: User Story 10 - Code Execution Sandbox (Priority: P3)

**Goal**: User and agent can execute code in sandboxed environment

**Independent Test**: Open sandbox → write Python script → execute → output shows → script modifying files updates plane

### Sandbox Backend

- [X] T149 [P] [US10] Create sandbox module structure in `src-tauri/src/sandbox/mod.rs`
- [X] T150 [P] [US10] Implement Python subprocess execution with limits in `src-tauri/src/sandbox/runtime.rs`
- [X] T151 [P] [US10] Implement JavaScript (Deno) execution in `src-tauri/src/sandbox/runtime.rs`
- [X] T152 [US10] Implement security permissions and resource limits in `src-tauri/src/sandbox/security.rs`
- [X] T153 [US10] Implement `execute_code` command in `src-tauri/src/commands/sandbox.rs`
- [X] T154 [US10] Implement `cancel_execution` command in `src-tauri/src/commands/sandbox.rs`
- [X] T155 [US10] Implement `list_available_runtimes` command in `src-tauri/src/commands/sandbox.rs`

### Sandbox Panel

- [X] T156 [US10] Create sandbox panel component in `src/ui/components/SandboxPanel.tsx`
- [X] T157 [US10] Add code editor with syntax highlighting in `src/ui/components/SandboxPanel.tsx`
- [X] T158 [US10] Create output display area in `src/ui/components/SandboxPanel.tsx`
- [X] T159 [US10] Add execution controls (run, cancel) in `src/ui/components/SandboxPanel.tsx`
- [X] T160 [US10] Display execution progress/timeout in `src/ui/components/SandboxPanel.tsx`

### Sandbox Integration

- [X] T161 [US10] Sync file modifications from sandbox to plane objects in `src/engine/ObjectManager.ts`
- [X] T162 [US10] Create agent execution approval workflow in `src/ui/components/ApprovalDialog.tsx`
- [X] T163 [US10] Integrate approval with agent action flow in `src/agent/Agent.ts`

**Checkpoint**: User Story 10 complete - sandboxed code execution working

---

## Phase 13: User Story 11 - Data Snippets and Fragments (Priority: P3)

**Goal**: User creates data snippets as standalone objects, linkable to files

**Independent Test**: Create snippet → type content → appears as object → link to file → visual connector shows

### Snippet Types

- [X] T164 [US11] Create `Snippet` type in `src/types/objects.ts`
- [X] T165 [US11] Create `Snippet` 3D representation in `src/objects/Snippet.ts`
- [X] T166 [US11] Implement inline snippet editing in `src/objects/Snippet.ts`

### Snippet Creation

- [X] T167 [US11] Add snippet creation hotkey/button in `src/engine/InputController.ts`
- [X] T168 [US11] Create snippet at cursor/center position in `src/engine/ObjectManager.ts`
- [X] T169 [US11] Add snippet tool to toolbar in `src/ui/components/Toolbar.tsx`

### Snippet Linking

- [X] T170 [US11] Detect proximity for link suggestion in `src/engine/ObjectManager.ts`
- [X] T171 [US11] Create visual link connector between snippet and file in `src/objects/Snippet.ts`
- [X] T172 [US11] Implement "save as snippet" for agent output in `src/ui/components/ChatPanel.tsx`
- [X] T173 [US11] Implement "extract to snippet" from editor selection in `src/ui/components/EditorPanel.tsx`

**Checkpoint**: User Story 11 complete - snippets and linking functional

---

## Phase 14: Workspace Persistence (Cross-Cutting)

**Purpose**: Save and load complete workspace state

### Workspace Commands

- [X] T174 [P] Implement `create_workspace` command in `src-tauri/src/commands/workspace.rs`
- [X] T175 [P] Implement `save_workspace` command in `src-tauri/src/commands/workspace.rs`
- [X] T176 [P] Implement `load_workspace` command in `src-tauri/src/commands/workspace.rs`
- [X] T177 Implement `export_workspace` command in `src-tauri/src/commands/workspace.rs`

### Persistence Service

- [X] T178 Create persistence service connecting stores to Tauri commands in `src/services/persistence.ts`
- [X] T179 Implement auto-save on state changes in `src/services/persistence.ts`
- [X] T180 Create workspace load/restore flow in `src/services/persistence.ts`

### Workspace Hooks

- [X] T181 Create `useWorkspace` hook for load/save operations in `src/ui/hooks/useWorkspace.ts`
- [X] T182 Add workspace management UI (new, open, save) in `src/ui/components/WorkspaceMenu.tsx`

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements affecting multiple user stories

- [X] T183 [P] Implement FPS counter/performance overlay in `src/ui/components/PerformanceOverlay.tsx`
- [X] T184 [P] Add keyboard shortcuts documentation in `src/ui/components/HelpPanel.tsx`
- [X] T185 [P] Implement settings panel (grid, physics toggle) in `src/ui/components/SettingsPanel.tsx`
- [X] T186 [P] Add `get_system_info` command for capabilities check in `src-tauri/src/commands/system.rs`
- [X] T187 Code cleanup: Extract shared types to common modules
- [X] T188 Performance: Implement Three.js instancing for file objects in `src/objects/FileObject.ts`
- [X] T189 Performance: Add LOD for objects when zoomed out in `src/engine/Scene.ts`
- [X] T190 Run quickstart.md validation to ensure dev environment works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - **BLOCKS all user stories**
- **Phases 3-5 (US1-3, P1)**: Depend on Phase 2 - Core MVP, do in order
- **Phases 6-9 (US4-6, US9, P2)**: Depend on Phase 5 (need object manipulation)
- **Phases 10-13 (US7-8, US10-11, P3)**: Depend on Phase 8 (need agent goals)
- **Phase 14 (Persistence)**: Can start after Phase 5, parallel to P2/P3 stories
- **Phase 15 (Polish)**: After all desired user stories complete

### User Story Dependencies

| Story | Depends On | Can Run Parallel With |
|-------|------------|----------------------|
| US1 (3D Plane) | Foundational | None (first) |
| US2 (File Import) | US1 | None |
| US3 (Selection) | US2 | None |
| US4 (Agent Presence) | US3 | US9 |
| US5 (Agent Chat) | US4 | US9 |
| US6 (Agent Goals) | US5 | US9 |
| US9 (Text Editing) | US3 | US4, US5, US6 |
| US7 (Boundaries) | US6 | US8, US10, US11 |
| US8 (Beacons) | US6 | US7, US10, US11 |
| US10 (Sandbox) | US6 | US7, US8, US11 |
| US11 (Snippets) | US3 | US7, US8, US10 |

### Parallel Opportunities

**Phase 1 Setup** (can run together):
- T002, T003, T004, T005, T006, T008, T009

**Phase 2 Foundational** (can run together):
- T010, T011, T012, T013 (TypeScript types)
- T015, T016, T017 (Rust models)
- T021, T022, T023 (Zustand stores)

**Within User Stories** (tasks marked [P]):
- File commands T041-T043
- LLM commands T090-T091
- Sandbox backends T149-T151
- Workspace commands T174-T176

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL**)
3. Complete Phase 3: User Story 1 (3D Plane)
4. Complete Phase 4: User Story 2 (File Import)
5. Complete Phase 5: User Story 3 (Selection)
6. **STOP and VALIDATE**: 3D plane with file objects, selectable and moveable
7. Deploy/demo MVP

### Incremental Delivery

| Increment | Stories Included | Deliverable |
|-----------|------------------|-------------|
| MVP | US1, US2, US3 | 3D file viewer with physics |
| +Agent | US4, US5, US6 | AI agent with chat and goals |
| +Editing | US9 | Text file editing |
| +Zones | US7, US8 | Boundaries and beacons |
| +Automation | US10, US11 | Sandbox and snippets |

### Task Count Summary

| Phase | Tasks | Parallel Tasks |
|-------|-------|----------------|
| Setup (P1) | 9 | 7 |
| Foundational (P2) | 21 | 14 |
| US1 (P1) | 10 | 0 |
| US2 (P1) | 17 | 3 |
| US3 (P1) | 13 | 0 |
| US4 (P2) | 15 | 0 |
| US5 (P2) | 14 | 2 |
| US6 (P2) | 11 | 0 |
| US9 (P2) | 12 | 2 |
| US7 (P3) | 14 | 0 |
| US8 (P3) | 12 | 0 |
| US10 (P3) | 15 | 3 |
| US11 (P3) | 10 | 0 |
| Persistence | 9 | 3 |
| Polish | 8 | 4 |
| **Total** | **190** | **38** |

---

## Notes

- Each [P] task operates on different files with no dependencies
- [US#] labels map tasks to user stories for traceability
- Complete each phase checkpoint before advancing
- Commit after each task or logical group
- MVP is achievable with Phases 1-5 (53 tasks)
