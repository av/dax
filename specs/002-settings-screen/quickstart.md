# Quickstart: Settings Screen

**Feature**: 002-settings-screen  
**Date**: 2025-12-04

## Prerequisites

- Dax development environment set up (see main README)
- Rust toolchain installed
- Node.js/pnpm installed

## Quick Setup

### 1. Install Dependencies

**Rust dependencies** (add to `src-tauri/Cargo.toml`):
```toml
tauri-plugin-autostart = "2.0.0"
tauri-plugin-store = "2.0.0"
keyring = "3"
```

**JavaScript dependencies**:
```bash
pnpm add @tauri-apps/plugin-autostart @tauri-apps/plugin-store
```

### 2. Register Plugins

In `src-tauri/src/lib.rs`:
```rust
.plugin(tauri_plugin_autostart::Builder::new().build())
.plugin(tauri_plugin_store::Builder::default().build())
```

### 3. Add Tauri Commands

Create `src-tauri/src/commands/settings.rs` and register in `mod.rs`.

### 4. Create Frontend Store

Create `src/ui/stores/settingsStore.ts` following existing Zustand patterns.

### 5. Extend SettingsPanel

Add new sections to `src/ui/components/SettingsPanel.tsx`:
- Agent Configuration (API URL, API Key)
- Application (Start on Startup)

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/Cargo.toml` | MODIFY | Add plugin dependencies |
| `src-tauri/src/lib.rs` | MODIFY | Register plugins and commands |
| `src-tauri/src/commands/mod.rs` | MODIFY | Export settings module |
| `src-tauri/src/commands/settings.rs` | CREATE | Settings Tauri commands |
| `src/services/settings.ts` | CREATE | Frontend settings service |
| `src/types/settings.ts` | CREATE | TypeScript interfaces |
| `src/ui/stores/settingsStore.ts` | CREATE | Zustand settings store |
| `src/ui/components/SettingsPanel.tsx` | MODIFY | Add Agent and App sections |
| `package.json` | MODIFY | Add JS plugin dependencies |

## Testing the Feature

### Manual Testing

1. **Open Settings**: Click gear icon or press `Ctrl+,`
2. **Enter API URL**: Type `https://api.openai.com/v1`
3. **Enter API Key**: Paste a test key
4. **Toggle Autostart**: Enable "Start on startup"
5. **Save**: Click Save or press `Ctrl+S`
6. **Verify Persistence**: Restart app, check settings persist
7. **Verify Keychain**: API key should show as masked (`••••••••`)

### Verify Autostart

**Linux**:
```bash
ls ~/.config/autostart/ | grep dax
```

**macOS**:
```bash
osascript -e 'tell application "System Events" to get the name of every login item'
```

**Windows**:
Check `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`

### Verify Keychain Storage

**Linux** (using secret-tool):
```bash
secret-tool lookup service dax
```

**macOS** (Keychain Access):
Search for "dax" in Keychain Access app

**Windows** (Credential Manager):
Open Credential Manager, look under "Generic Credentials"

## Common Issues

### Keychain Access Denied (Linux)

Ensure `libsecret` is installed:
```bash
# Ubuntu/Debian
sudo apt install libsecret-1-dev

# Fedora
sudo dnf install libsecret-devel
```

### Autostart Not Working (Linux)

Check XDG autostart directory permissions:
```bash
chmod 755 ~/.config/autostart
```

### API Key Not Persisting

Check keychain service is running:
```bash
# Linux (GNOME Keyring)
systemctl --user status gnome-keyring-daemon
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
├─────────────────────────────────────────────────────────┤
│  SettingsPanel.tsx                                       │
│    └── Uses settingsStore (Zustand)                     │
│          └── Calls services/settings.ts                 │
│                └── invoke() Tauri commands              │
├─────────────────────────────────────────────────────────┤
│                     Backend (Rust/Tauri)                 │
├─────────────────────────────────────────────────────────┤
│  commands/settings.rs                                    │
│    ├── get_app_settings  → tauri-plugin-store          │
│    ├── save_app_settings → tauri-plugin-store          │
│    │                     → tauri-plugin-autostart       │
│    ├── set_api_key       → keyring crate               │
│    ├── has_api_key       → keyring crate               │
│    └── delete_api_key    → keyring crate               │
├─────────────────────────────────────────────────────────┤
│                     OS Layer                             │
├─────────────────────────────────────────────────────────┤
│  ├── Keychain (macOS) / Credential Manager (Windows)    │
│  │   / Secret Service (Linux)                           │
│  ├── Login Items (macOS) / Registry (Windows)           │
│  │   / XDG Autostart (Linux)                            │
│  └── App Data Directory (app-settings.json)             │
└─────────────────────────────────────────────────────────┘
```
