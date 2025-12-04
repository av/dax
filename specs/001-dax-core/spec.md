# Feature Specification: Dax Core Platform

**Feature Branch**: `001-dax-core`
**Created**: 2024-12-04
**Status**: Draft
**Input**: User description: "A novel Tauri-based web-application that transforms how user interacts with LLMs/Agents. The application presents a 3D view of a data plane where files and data snippets are presented as physical objects with physics, gravity. Agent is present as a moveable actor that can approach data. User navigates this view similar to RTS camera - from the top, but able to zoom in where needed. User can select, drag and move data and file presentations. Agent has its own agenda based on the file content - it sets its own goals and follows up on them, but user can always ask it about what's going on or direct its progress. There's a sandbox for code execution that allows programmatically work with common file types. User can drop in new files from their system, draw boundaries with specific instructions and place beacons that indicate specific types of desired agent behavior depending on how close the agent is to them. Text files can be opened and edited in the app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 3D Data Plane Navigation (Priority: P1)

User launches Dax and sees a 3D plane from an elevated, top-down perspective. Files and data appear as physical objects resting on the plane. The user can pan, rotate, and zoom the camera using RTS-style controls (drag-to-pan, scroll-to-zoom, keyboard navigation). Objects have subtle physics—they settle with gravity and can gently collide.

**Why this priority**: This is the foundational visual experience. Without the 3D plane and camera controls, no other feature can be demonstrated or tested. It establishes the core spatial metaphor of the entire application.

**Independent Test**: Launch application → empty plane renders with grid → camera responds to pan/zoom/rotate inputs → FPS maintains 60+ on target hardware.

**Acceptance Scenarios**:

1. **Given** application starts, **When** main window opens, **Then** a 3D plane with grid renders at 60 FPS with default camera position (elevated top-down view)
2. **Given** plane is visible, **When** user scrolls mouse wheel, **Then** camera zooms in/out smoothly maintaining focus point
3. **Given** plane is visible, **When** user drags with middle mouse button, **Then** camera pans across the plane
4. **Given** plane is visible, **When** user drags with right mouse button, **Then** camera rotates around focal point
5. **Given** plane is visible, **When** user presses WASD keys, **Then** camera pans in the corresponding direction

---

### User Story 2 - File Import and Physical Representation (Priority: P1)

User can drag files from their operating system and drop them onto the 3D plane. Each file materializes as a physical object with appearance based on file type (documents as pages/books, code files as terminal-styled blocks, images as framed pictures, etc.). Objects have physics properties—they fall onto the plane, can be pushed, and settle naturally.

**Why this priority**: Files are the primary data source. Users must be able to bring their data into the spatial environment before any agent interaction or organization can occur.

**Independent Test**: Drag a file from desktop → drop on plane → object appears with correct visual representation → object settles with physics → file metadata accessible.

**Acceptance Scenarios**:

1. **Given** plane is visible, **When** user drags a file from OS file explorer over window, **Then** drop zone indicator appears
2. **Given** file is dragged over plane, **When** user releases, **Then** file object spawns at drop location with type-appropriate 3D model
3. **Given** file object exists, **When** physics simulation runs, **Then** object settles onto plane with realistic gravity
4. **Given** multiple files dropped, **When** they overlap, **Then** objects gently push apart (collision response)
5. **Given** file object on plane, **When** user hovers over it, **Then** tooltip shows filename, type, size, and preview (if applicable)

---

### User Story 3 - Object Selection and Manipulation (Priority: P1)

User can click to select objects, drag to move them across the plane, and multi-select using box selection or shift-click. Selected objects highlight visually. Objects can be arranged, stacked, or spread out according to user preference.

**Why this priority**: Direct manipulation is core to the spatial interaction paradigm. Users must be able to organize their data spatially before agent interactions add value.

**Independent Test**: Click object → it highlights → drag to new position → release → object stays at new position with physics settling.

**Acceptance Scenarios**:

1. **Given** file object on plane, **When** user clicks it, **Then** object shows selection highlight (glow, outline, or elevation)
2. **Given** object selected, **When** user drags it, **Then** object follows cursor maintaining plane constraint
3. **Given** object being dragged, **When** user releases, **Then** object drops and settles with physics
4. **Given** multiple objects on plane, **When** user drags selection box, **Then** all intersecting objects become selected
5. **Given** object selected, **When** user shift-clicks another object, **Then** both objects are now selected
6. **Given** objects selected, **When** user presses Delete, **Then** objects are removed from plane (with confirmation for files)

---

### User Story 4 - Agent Presence and Movement (Priority: P2)

An AI agent appears on the plane as a distinct, animated actor (robot, orb, character, etc.). The agent can move autonomously across the plane, approaching different data objects. User can see where the agent is and what it's currently focused on. The agent's movement is purposeful and visually communicative.

**Why this priority**: The agent is the second core entity after the data plane. Its presence enables all AI-assisted workflows, but basic data viewing works without it.

**Independent Test**: Agent spawns on plane → agent selects a file to approach → agent moves toward it with smooth animation → agent "focuses" on file (visual indicator).

**Acceptance Scenarios**:

1. **Given** plane with file objects, **When** agent feature enabled, **Then** agent entity appears on plane with idle animation
2. **Given** agent on plane, **When** agent decides to investigate a file, **Then** agent moves toward file with pathfinding (avoids obstacles)
3. **Given** agent moving, **When** agent reaches destination, **Then** agent plays "focus" animation and file shows "being analyzed" indicator
4. **Given** agent focusing on file, **When** user hovers agent, **Then** tooltip shows current agent status and intention
5. **Given** agent on plane, **When** user clicks on agent, **Then** agent context panel opens showing current goals and activity log

---

### User Story 5 - Agent Communication and Direction (Priority: P2)

User can interact with the agent through a chat interface or direct commands. The agent responds to questions about what it's doing, why, and what it plans next. User can give the agent new tasks, redirect its focus, or ask it to pause/resume autonomous behavior.

**Why this priority**: Communication transforms the agent from a visual novelty into a useful collaborator. This enables the core human-AI interaction loop.

**Independent Test**: Open chat with agent → ask "What are you doing?" → agent responds with current task → give command "Focus on this file" → agent acknowledges and changes behavior.

**Acceptance Scenarios**:

1. **Given** agent on plane, **When** user presses designated key or clicks chat button, **Then** agent chat panel opens
2. **Given** chat panel open, **When** user types question, **Then** agent responds contextually (aware of current state, files, goals)
3. **Given** agent doing something, **When** user asks "What are you doing?", **Then** agent explains current task and reasoning
4. **Given** file selected, **When** user tells agent "Analyze this", **Then** agent pathfinds to file and begins analysis
5. **Given** agent acting autonomously, **When** user says "Pause", **Then** agent stops current activity and awaits instruction
6. **Given** agent paused, **When** user says "Continue" or "Resume", **Then** agent resumes autonomous goal pursuit

---

### User Story 6 - Agent Autonomous Goals (Priority: P2)

The agent maintains its own agenda based on file contents and user patterns. It sets goals like "organize these related files", "summarize this document", "find inconsistencies in this code". Goals are visible to the user. The agent works toward goals autonomously but transparently.

**Why this priority**: Autonomous behavior differentiates Dax from a simple file viewer with chat. This enables proactive AI assistance.

**Independent Test**: Add several related files → agent identifies relationship → agent creates goal "organize related files" → agent begins working toward goal → progress visible in goals panel.

**Acceptance Scenarios**:

1. **Given** agent has analyzed files, **When** patterns detected, **Then** agent creates goal and adds to goals list
2. **Given** goals exist, **When** user opens goals panel, **Then** all active goals shown with status (pending, in progress, completed)
3. **Given** goal in progress, **When** agent makes progress, **Then** progress indicator updates (percentage, steps completed)
4. **Given** goal completed, **When** result ready, **Then** user notified and result accessible (summary, organization, etc.)
5. **Given** user reviews goal, **When** user disagrees, **Then** user can cancel goal or modify it
6. **Given** multiple goals, **When** agent decides priority, **Then** prioritization is explainable and adjustable by user

---

### User Story 7 - Boundaries and Zones (Priority: P3)

User can draw boundaries on the plane, creating zones with specific instructions. Boundaries can specify rules like "files here should be summarized", "code in this area should be reviewed for security", or "keep this zone organized by date". The agent respects these boundaries when operating.

**Why this priority**: Boundaries enable spatial organization of agent behavior, a key differentiator of the 3D paradigm, but require agent functionality to be meaningful.

**Independent Test**: Draw a rectangular boundary → add instruction "organize by file type" → drag files into boundary → agent respects instruction and organizes files.

**Acceptance Scenarios**:

1. **Given** plane visible, **When** user activates boundary tool, **Then** cursor changes to drawing mode
2. **Given** boundary tool active, **When** user draws closed shape, **Then** boundary appears as visible zone on plane
3. **Given** boundary created, **When** user clicks boundary, **Then** instruction editor opens
4. **Given** boundary with instructions, **When** agent enters or files placed inside, **Then** agent applies zone instructions
5. **Given** boundary exists, **When** user drags boundary edge, **Then** boundary resizes
6. **Given** boundary exists, **When** user presses delete with boundary selected, **Then** boundary removed (files remain)

---

### User Story 8 - Beacons for Agent Behavior Modulation (Priority: P3)

User can place beacons on the plane that influence agent behavior based on proximity. Beacon types include: "attract" (agent prioritizes nearby objects), "repel" (agent avoids area), "speed up" (agent works faster, less thorough), "slow down" (agent works more carefully), "notify" (agent alerts user when near), etc.

**Why this priority**: Beacons provide spatial control over agent behavior without explicit commands, enabling ambient guidance. Requires agent movement to be meaningful.

**Independent Test**: Place "attract" beacon near files → agent prioritizes approaching those files → move beacon → agent priority changes accordingly.

**Acceptance Scenarios**:

1. **Given** beacon tool selected, **When** user clicks on plane, **Then** beacon type selector appears
2. **Given** beacon type selected, **When** confirmed, **Then** beacon appears on plane with visual indicator of type and range
3. **Given** "attract" beacon placed, **When** agent plans movement, **Then** agent weights nearby objects higher in priority
4. **Given** "repel" beacon placed, **When** agent pathfinds, **Then** agent avoids beacon radius
5. **Given** "notify" beacon placed, **When** agent enters radius, **Then** user receives notification
6. **Given** beacon on plane, **When** user drags beacon, **Then** beacon moves and influence zone updates in real-time
7. **Given** beacon on plane, **When** user adjusts radius slider, **Then** influence zone grows or shrinks visually

---

### User Story 9 - Text File Viewing and Editing (Priority: P2)

User can open text files from the plane in an integrated editor. The editor supports syntax highlighting for code files, markdown rendering for documentation, and plain text editing. Changes are saved back to the file. The editor can be opened inline (floating panel) or focused (full view).

**Why this priority**: Editing text files is essential for the application to be useful for actual work, not just visualization. Core productivity feature.

**Independent Test**: Double-click text file object → editor opens with file content → edit content → save → file on disk updated.

**Acceptance Scenarios**:

1. **Given** text file object on plane, **When** user double-clicks it, **Then** text editor panel opens with file content
2. **Given** code file open in editor, **When** content renders, **Then** syntax highlighting applied for detected language
3. **Given** markdown file open, **When** toggle pressed, **Then** rendered markdown preview shown
4. **Given** file content edited, **When** user presses Ctrl+S, **Then** changes saved to disk
5. **Given** unsaved changes, **When** user tries to close editor, **Then** confirmation prompt appears
6. **Given** editor open, **When** user clicks outside or presses Escape, **Then** editor minimizes/closes (unsaved check first)
7. **Given** file open, **When** agent analyzes same file, **Then** editor shows agent activity indicator

---

### User Story 10 - Code Execution Sandbox (Priority: P3)

User and agent can execute code in a sandboxed environment. The sandbox supports common scripting languages (Python, JavaScript, shell) and can programmatically manipulate files on the plane. Results appear as output objects or modify existing files. Sandbox has resource limits and security boundaries.

**Why this priority**: Code execution enables automation and programmatic workflows, but requires solid file handling and agent infrastructure first.

**Independent Test**: Open sandbox → write Python script to list files → execute → output shows file list → script that renames files updates plane objects.

**Acceptance Scenarios**:

1. **Given** sandbox panel opened, **When** user types code, **Then** syntax highlighting and basic autocomplete available
2. **Given** code in sandbox, **When** user executes, **Then** code runs in isolated environment with progress indicator
3. **Given** code running, **When** timeout exceeded, **Then** execution terminates with timeout error
4. **Given** code produces output, **When** execution completes, **Then** output displayed in sandbox results panel
5. **Given** code modifies files on plane, **When** execution completes, **Then** plane reflects changes (file updates, new objects)
6. **Given** code attempts forbidden operation, **When** blocked, **Then** clear error message explains security restriction
7. **Given** agent wants to run code, **When** initiated, **Then** user can approve/deny before execution

---

### User Story 11 - Data Snippets and Fragments (Priority: P3)

Beyond files, user can create data snippets—text fragments, notes, extracted content, agent outputs—that exist as their own objects on the plane. Snippets are lightweight, editable, and can be linked to source files. They enable working with pieces of information, not just whole files.

**Why this priority**: Snippets enable granular data work beyond file-level manipulation, but files must work first.

**Independent Test**: Create new snippet → type content → snippet appears as object → move it near related file → link them.

**Acceptance Scenarios**:

1. **Given** plane visible, **When** user presses hotkey or button, **Then** new empty snippet object created at cursor/center
2. **Given** snippet created, **When** user types, **Then** content saved in snippet (inline editing)
3. **Given** snippet on plane, **When** user drags near file, **Then** link suggestion appears
4. **Given** snippet and file linked, **When** viewing either, **Then** visual connector shows relationship
5. **Given** agent produces output, **When** user clicks "save as snippet", **Then** output becomes snippet object on plane
6. **Given** text selected in file editor, **When** user extracts, **Then** selection becomes snippet with link to source

---

### Edge Cases

- What happens when user drops 1000+ files at once? (Progressive loading, performance throttling, clustering)
- How does system handle when agent becomes stuck or loops on a goal? (Loop detection, user notification, manual intervention)
- What happens when file on disk is modified externally while open in editor? (File watcher, conflict resolution dialog)
- How does system handle network disconnect during LLM API call? (Retry logic, offline mode, queue commands)
- What happens when sandbox code runs infinite loop? (Timeout, resource limits, force termination)
- How does system handle corrupt or unreadable files? (Error objects, graceful degradation, user notification)
- What happens when boundaries overlap? (Priority rules, visual indication, instruction merging)
- How does physics handle extreme zoom levels? (LOD system, physics sleeping, performance optimization)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a 3D plane with physics simulation at minimum 60 FPS on target hardware
- **FR-002**: System MUST support RTS-style camera controls (pan, zoom, rotate)
- **FR-003**: System MUST accept file drops from operating system and create visual representations
- **FR-004**: System MUST support physics simulation for objects (gravity, collision, settling)
- **FR-005**: System MUST allow selection and manipulation of objects (click, drag, multi-select, delete)
- **FR-006**: System MUST display an AI agent as a moveable, animated entity on the plane
- **FR-007**: System MUST enable bidirectional communication between user and agent (chat interface)
- **FR-008**: System MUST support agent autonomous goal creation based on file analysis
- **FR-009**: System MUST allow user to create boundaries with associated instructions
- **FR-010**: System MUST allow user to place beacons that modulate agent behavior by proximity
- **FR-011**: System MUST provide integrated text editor with syntax highlighting
- **FR-012**: System MUST provide sandboxed code execution environment
- **FR-013**: System MUST support creation and manipulation of data snippets
- **FR-014**: System MUST persist workspace state (object positions, boundaries, beacons, agent state)
- **FR-015**: System MUST integrate with LLM API for agent intelligence [NEEDS CLARIFICATION: which LLM provider(s) - OpenAI, Anthropic, local models?]

### Key Entities

- **DataObject**: Base entity for anything on the plane (files, snippets). Has position, rotation, physics properties, visual representation, metadata.
- **FileObject**: Extends DataObject. Linked to filesystem path. Has file type, size, content access, preview capability.
- **Snippet**: Extends DataObject. Contains text content, optional source link, creation timestamp.
- **Agent**: Singleton entity representing AI actor. Has position, current goal, goal queue, state (idle, moving, analyzing, waiting).
- **Boundary**: Polygon zone on plane with associated instructions (text). Has vertices, color, instruction list.
- **Beacon**: Point entity with type, radius, and intensity. Influences agent behavior within radius.
- **Workspace**: Container for all entities. Has camera state, settings, persistence path.
- **Goal**: Agent objective with description, priority, status, progress, associated objects.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Application maintains 60 FPS with 100 objects on plane (physics active)
- **SC-002**: File drop to visual representation completes in under 500ms
- **SC-003**: Agent responds to user query within 2 seconds (excluding LLM latency)
- **SC-004**: Camera controls feel responsive with under 16ms input latency
- **SC-005**: Text editor opens files under 10MB within 1 second
- **SC-006**: Sandbox executes simple scripts within 5 seconds
- **SC-007**: Workspace save/load completes within 3 seconds for 500 objects
- **SC-008**: 80% of first-time users successfully drop a file and move it within 2 minutes (usability)
- **SC-009**: Agent goal creation and pursuit visible and understandable to users (qualitative testing)
- **SC-010**: System runs stably for 8+ hour sessions without memory leaks or crashes
