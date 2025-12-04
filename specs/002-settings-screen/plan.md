# Implementation Plan: Settings Screen

**Branch**: `002-settings-screen` | **Date**: 2025-12-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-settings-screen/spec.md`

## Summary

Configuration/settings screen with two main sections: Agent settings (OpenAI-compatible API URL and API key) and Application settings (start on startup). The feature extends the existing `SettingsPanel.tsx` component with new sections, adds Tauri commands for secure credential storage and autostart management, and creates a new settings store for application-level configuration.

## Technical Context

**Language/Version**: TypeScript 5.9 (frontend), Rust 1.77.2 (backend/Tauri)  
**Primary Dependencies**: React 19, Zustand 5, Tauri 2.9.4, tauri-plugin-autostart (new)  
**Storage**: Tauri secure storage (keychain/credential manager) for API key, JSON config file for other settings  
**Testing**: Vitest (frontend - to be added), cargo test (backend)  
**Target Platform**: Linux, macOS, Windows (desktop via Tauri)  
**Project Type**: Tauri app (frontend + backend)  
**Performance Goals**: Settings save < 500ms, settings load on startup < 100ms  
**Constraints**: API key must never appear in logs or plain-text files  
**Scale/Scope**: Single user desktop application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Smart Concise Code | ✅ PASS | Extends existing SettingsPanel; reuses component patterns |
| II. Maintainability | ✅ PASS | Follows existing store patterns (Zustand); consistent with codebase |
| III. Exceptional UX | ✅ PASS | Inline validation, visual feedback, masked API key with reveal toggle |
| IV. Performance | ✅ PASS | Settings are simple key-value operations; no complex computation |
| V. Test-First Development | ⚠️ REQUIRES | Tests must be added for Tauri commands and settings store |

**Gate Result**: PASS (with test requirement noted)

### Post-Design Re-check (Phase 1 Complete)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Smart Concise Code | ✅ PASS | 3 new files (settings.rs, settingsStore.ts, settings.ts service), extends 1 existing |
| II. Maintainability | ✅ PASS | Uses official Tauri plugins (autostart, store); follows existing command patterns |
| III. Exceptional UX | ✅ PASS | Error messages are actionable; connection test provides feedback |
| IV. Performance | ✅ PASS | Keychain lookups are fast; store plugin handles auto-save |
| V. Test-First Development | ⚠️ REQUIRES | Backend: cargo test for commands; Frontend: Vitest for store |
| Complexity Budget | ✅ PASS | No functions exceed cyclomatic complexity 10; settings.rs < 300 lines |

**Post-Design Gate Result**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/002-settings-screen/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── settings-commands.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── services/
│   └── settings.ts              # NEW: Settings service for Tauri commands
├── types/
│   └── settings.ts              # NEW: Settings types/interfaces
└── ui/
    ├── components/
    │   └── SettingsPanel.tsx    # MODIFY: Add Agent and Application sections
    └── stores/
        └── settingsStore.ts     # NEW: Application settings store

src-tauri/
├── Cargo.toml                   # MODIFY: Add tauri-plugin-autostart
└── src/
    ├── lib.rs                   # MODIFY: Register new commands
    └── commands/
        └── settings.rs          # NEW: Settings commands (API key, autostart)
```

**Structure Decision**: Extends existing Tauri app structure. Frontend follows established patterns with stores in `ui/stores/` and services in `services/`. Backend adds new command module following existing pattern in `commands/`.

## Complexity Tracking

> No constitution violations requiring justification.
