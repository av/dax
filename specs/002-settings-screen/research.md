# Research: Settings Screen

**Feature**: 002-settings-screen  
**Date**: 2025-12-04

## Research Tasks

### 1. Autostart Plugin for Tauri

**Task**: Find best practices for enabling "start on startup" in Tauri apps.

**Decision**: Use `tauri-plugin-autostart` (official Tauri plugin)

**Rationale**:
- Official Tauri plugin maintained in the plugins-workspace
- Cross-platform support (Windows, macOS, Linux)
- Simple JavaScript API: `enable()`, `disable()`, `isEnabled()`
- Handles OS-specific registration (Registry, Login Items, XDG autostart)

**Implementation**:
```toml
# Cargo.toml
tauri-plugin-autostart = "2.0.0"
```
```rust
// lib.rs
.plugin(tauri_plugin_autostart::Builder::new().build())
```
```typescript
// Frontend
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
```

**Alternatives Considered**:
- Manual OS-specific implementation: Rejected because plugin handles cross-platform complexity
- Environment-based startup scripts: Rejected because not integrated with OS GUI expectations

---

### 2. Secure API Key Storage

**Task**: Research secure credential storage for API keys in Tauri.

**Decision**: Use `keyring` Rust crate with custom Tauri commands

**Rationale**:
- `keyring` crate provides cross-platform access to OS keychains:
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service (via libsecret/GNOME Keyring)
- No official Tauri keychain plugin exists
- Custom commands give full control over what's stored and how
- API keys never touch frontend or logs in plaintext

**Implementation**:
```toml
# Cargo.toml
keyring = "3"
```
```rust
// commands/settings.rs
use keyring::Entry;

#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), String> {
    let entry = Entry::new("dax", "api_key").map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]  
pub fn get_api_key() -> Result<Option<String>, String> {
    let entry = Entry::new("dax", "api_key").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    let entry = Entry::new("dax", "api_key").map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())
}
```

**Alternatives Considered**:
- Encrypted file storage: Rejected because managing encryption keys is complex and less secure than OS keychain
- Environment variables: Rejected because not persistent and requires user to manage
- `tauri-plugin-store` with encryption: Rejected because adds complexity; OS keychain is purpose-built for credentials

---

### 3. Settings Persistence (non-sensitive)

**Task**: Research best approach for persisting non-sensitive settings (API URL, autostart preference).

**Decision**: Use `tauri-plugin-store` for JSON-based settings file

**Rationale**:
- Official Tauri plugin with auto-save and change listeners
- Simple key-value storage with TypeScript support
- Already available in Tauri ecosystem (no new dependencies in Rust)
- Stores in app data directory by default

**Implementation**:
```sh
pnpm add @tauri-apps/plugin-store
```
```toml
# Cargo.toml
tauri-plugin-store = "2.0.0"
```
```typescript
import { Store } from '@tauri-apps/plugin-store';

const store = await Store.load('app-settings.json', {
  defaults: {
    apiUrl: '',
    startOnStartup: false
  },
  autoSave: true
});
```

**Alternatives Considered**:
- localStorage: Rejected because not persistent across app reinstalls, not accessible from Rust
- Custom JSON file handling: Rejected because plugin handles edge cases (concurrent access, auto-save)
- SQLite (already in project): Rejected because overkill for simple key-value settings

---

### 4. API URL Validation

**Task**: Determine validation approach for OpenAI-compatible API URL.

**Decision**: Client-side regex validation + optional connectivity test

**Rationale**:
- URL must be valid HTTP(S) and end with `/v1`
- Validation happens before save to give immediate feedback
- Optional "Test Connection" button to verify reachability (not mandatory for save)

**Implementation**:
```typescript
function validateApiUrl(url: string): { valid: boolean; error?: string } {
  if (!url) return { valid: true }; // Empty is allowed (clears setting)
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS' };
    }
    if (!parsed.pathname.endsWith('/v1')) {
      return { valid: false, error: 'URL must end with /v1' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

**Alternatives Considered**:
- Server-side validation only: Rejected because slower feedback loop
- Strict connectivity requirement: Rejected because user may configure offline

---

### 5. Frontend State Management

**Task**: Determine how settings state integrates with existing Zustand stores.

**Decision**: Create dedicated `settingsStore` separate from workspace settings

**Rationale**:
- Application settings (API key, autostart) are global, not per-workspace
- Existing `workspaceStore` handles per-workspace preferences (grid, physics)
- Separation of concerns: `settingsStore` for app config, `workspaceStore` for workspace config
- Settings load at app startup, before any workspace is opened

**Implementation**:
```typescript
// ui/stores/settingsStore.ts
interface AppSettings {
  apiUrl: string;
  hasApiKey: boolean;  // Never store actual key in frontend state
  startOnStartup: boolean;
  isLoading: boolean;
  error: string | null;
}
```

**Alternatives Considered**:
- Extend workspaceStore: Rejected because these are app-level, not workspace-level settings
- React Context only: Rejected because Zustand provides better devtools and subscription patterns

---

## Summary

| Component | Technology | Notes |
|-----------|------------|-------|
| Autostart | `tauri-plugin-autostart` | Official plugin, cross-platform |
| API Key Storage | `keyring` crate | OS keychain, never in plaintext |
| Settings File | `tauri-plugin-store` | JSON, auto-save, app data dir |
| URL Validation | Client-side regex | Immediate feedback, no server round-trip |
| State Management | New Zustand store | Separate from workspace settings |

## Dependencies to Add

**Rust (Cargo.toml)**:
```toml
tauri-plugin-autostart = "2.0.0"
tauri-plugin-store = "2.0.0"
keyring = "3"
```

**JavaScript (package.json)**:
```json
{
  "@tauri-apps/plugin-autostart": "^2.0.0",
  "@tauri-apps/plugin-store": "^2.0.0"
}
```
