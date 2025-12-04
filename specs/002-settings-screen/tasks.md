````markdown
# Tasks: Settings Screen

**Input**: Design documents from `/specs/002-settings-screen/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not explicitly requested in feature specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/` (React/TypeScript)
- **Backend**: `src-tauri/src/` (Rust/Tauri)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [X] T001 Add Rust dependencies to src-tauri/Cargo.toml (tauri-plugin-autostart, tauri-plugin-store, keyring)
- [X] T002 Add JavaScript dependencies via pnpm (@tauri-apps/plugin-autostart, @tauri-apps/plugin-store)
- [X] T003 [P] Register Tauri plugins in src-tauri/src/lib.rs (autostart, store)
- [X] T004 [P] Create settings types in src/types/settings.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create settings commands module in src-tauri/src/commands/settings.rs with get_app_settings command
- [X] T006 Add save_app_settings command to src-tauri/src/commands/settings.rs
- [X] T007 Export settings module and register commands in src-tauri/src/commands/mod.rs
- [X] T008 Register settings commands in src-tauri/src/lib.rs invoke_handler
- [X] T009 Create settings service in src/services/settings.ts with getAppSettings and saveAppSettings
- [X] T010 Create settingsStore Zustand store in src/ui/stores/settingsStore.ts
- [X] T011 Export settingsStore from src/ui/stores/index.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Configure Agent API Connection (Priority: P1) 🎯 MVP

**Goal**: User can configure API URL and API key for agent communication with OpenAI-compatible LLM services

**Independent Test**: Open settings, enter API URL (ending with /v1) and API key, save, verify agent can make API calls

### Implementation for User Story 1

- [X] T012 [US1] Add API URL validation function to src/services/settings.ts (HTTP/HTTPS, ends with /v1)
- [X] T013 [US1] Add set_api_key command to src-tauri/src/commands/settings.rs using keyring crate
- [X] T014 [US1] Add has_api_key command to src-tauri/src/commands/settings.rs
- [X] T015 [US1] Add delete_api_key command to src-tauri/src/commands/settings.rs
- [X] T016 [US1] Add get_api_key_internal function (non-command) to src-tauri/src/commands/settings.rs for LLM bridge
- [X] T017 [US1] Add setApiKey, hasApiKey, deleteApiKey functions to src/services/settings.ts
- [X] T018 [US1] Add API key actions to settingsStore in src/ui/stores/settingsStore.ts
- [X] T019 [US1] Add Agent Configuration section to src/ui/components/SettingsPanel.tsx with API URL input
- [X] T020 [US1] Add API Key input with mask/reveal toggle to src/ui/components/SettingsPanel.tsx
- [X] T021 [US1] Add inline validation errors for API URL in src/ui/components/SettingsPanel.tsx
- [X] T022 [US1] Add test_api_connection command to src-tauri/src/commands/settings.rs
- [X] T023 [US1] Add testApiConnection function to src/services/settings.ts
- [X] T024 [US1] Add "Test Connection" button with feedback to src/ui/components/SettingsPanel.tsx

**Checkpoint**: User Story 1 complete - API URL and API key can be configured and saved securely

---

## Phase 4: User Story 2 - Access Settings Screen (Priority: P1)

**Goal**: User can easily open and close the settings screen from the main application

**Independent Test**: Click settings button/keyboard shortcut, verify settings screen opens with all options visible, close with Escape

### Implementation for User Story 2

- [X] T025 [US2] Verify settings button exists in src/ui/components/Toolbar.tsx (already exists - may need icon update)
- [X] T026 [US2] Add keyboard shortcut (Ctrl+,) for opening settings in src/engine/InputController.ts
- [X] T027 [US2] Add close on Escape key to src/ui/components/SettingsPanel.tsx
- [X] T028 [US2] Add unsaved changes detection to settingsStore in src/ui/stores/settingsStore.ts
- [X] T029 [US2] Add unsaved changes confirmation dialog to src/ui/components/SettingsPanel.tsx
- [X] T030 [US2] Add save button with visual feedback (success/error) to src/ui/components/SettingsPanel.tsx

**Checkpoint**: User Story 2 complete - settings screen is accessible and closeable with proper UX

---

## Phase 5: User Story 3 - Configure Application Startup Behavior (Priority: P2)

**Goal**: User can configure whether the application starts automatically on system boot

**Independent Test**: Toggle startup setting, restart computer, verify application behavior matches setting

### Implementation for User Story 3

- [X] T031 [US3] Add autostart enable/disable logic to save_app_settings in src-tauri/src/commands/settings.rs
- [X] T032 [US3] Add Application Settings section with startup toggle to src/ui/components/SettingsPanel.tsx
- [X] T033 [US3] Handle autostart permission errors gracefully with error message in src/ui/components/SettingsPanel.tsx

**Checkpoint**: User Story 3 complete - autostart toggle works across all supported operating systems

---

## Phase 6: User Story 4 - Secure API Key Storage (Priority: P2)

**Goal**: API key is stored securely using OS keychain, never in plain text

**Independent Test**: Save API key, close app, verify key is not in plain-text config files, verify masked display on reopen

### Implementation for User Story 4

- [X] T034 [US4] Verify API key stored via keyring (already implemented in T013-T016) - add logging guards
- [X] T035 [US4] Ensure API key field shows masked placeholder (••••••••) when key exists in src/ui/components/SettingsPanel.tsx
- [X] T036 [US4] Add clear API key button to src/ui/components/SettingsPanel.tsx with confirmation

**Checkpoint**: User Story 4 complete - API key is never visible in logs or plain-text files

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T037 [P] Load settings on app startup in src/App.tsx or src/main.tsx
- [X] T038 [P] Add settings loading state indicator to src/ui/components/SettingsPanel.tsx
- [X] T039 [P] Add error boundary/fallback for corrupted settings (reset to defaults)
- [X] T040 Run quickstart.md manual validation checklist
- [X] T041 Update src-tauri/capabilities/default.json if needed for plugin permissions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 and can run in parallel
  - US3 and US4 are both P2 and can run in parallel (after P1 if sequential)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - Independent of US1/US2
- **User Story 4 (P2)**: Builds on keyring implementation from US1 (T013-T016) but adds security hardening

### Within Each User Story

- Backend commands before frontend service calls
- Service functions before store actions
- Store actions before UI components
- Core implementation before polish

### Parallel Opportunities

- T003 and T004 can run in parallel (different files)
- T037, T038, T039 can run in parallel (different concerns)
- User Story 1 and User Story 2 can be worked on in parallel (different aspects)
- User Story 3 and User Story 4 can be worked on in parallel

---

## Parallel Example: Setup Phase

```bash
# After T001 and T002 complete, launch in parallel:
Task T003: "Register Tauri plugins in src-tauri/src/lib.rs"
Task T004: "Create settings types in src/types/settings.ts"
```

## Parallel Example: User Stories 1 & 2 (Both P1)

```bash
# After Foundational phase, two developers can work in parallel:
Developer A: User Story 1 (T012-T024) - API Configuration
Developer B: User Story 2 (T025-T030) - Settings Access
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Configure Agent API)
4. Complete Phase 4: User Story 2 (Access Settings)
5. **STOP and VALIDATE**: Test settings screen end-to-end
6. Deploy/demo if ready - agent can now communicate with LLM

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 + 2 → Core settings functional (MVP!)
3. User Story 3 → Autostart feature added
4. User Story 4 → Security hardening complete
5. Polish → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- API key MUST never appear in logs - verify T034 guards
- Keychain access may require OS permissions on first use
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

````
