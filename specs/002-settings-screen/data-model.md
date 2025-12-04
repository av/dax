# Data Model: Settings Screen

**Feature**: 002-settings-screen  
**Date**: 2025-12-04

## Entities

### AppSettings (Frontend State)

Application-level settings stored in Zustand. The API key itself is never stored here—only a flag indicating whether one exists.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `apiUrl` | `string` | OpenAI-compatible API base URL | Valid HTTP(S) URL ending with `/v1`, or empty |
| `hasApiKey` | `boolean` | Whether an API key is stored in keychain | Read-only (derived from backend) |
| `startOnStartup` | `boolean` | Whether app launches on system boot | None |
| `isLoading` | `boolean` | Loading state for async operations | None |
| `error` | `string \| null` | Last error message | None |

### PersistedSettings (Storage - tauri-plugin-store)

Non-sensitive settings persisted to `app-settings.json` in the app data directory.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiUrl` | `string` | `""` | OpenAI-compatible API base URL |
| `startOnStartup` | `boolean` | `false` | Autostart preference |

### SecureCredential (Storage - OS Keychain)

Stored via the `keyring` crate in the OS credential manager.

| Service | User | Value |
|---------|------|-------|
| `dax` | `api_key` | The actual API key string |

## State Transitions

### Settings Load Flow

```
App Startup
    │
    ▼
┌─────────────────────┐
│  Load app-settings  │ ← tauri-plugin-store
│  (apiUrl, startup)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Check API key      │ ← keyring (has_api_key command)
│  existence          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Initialize         │
│  settingsStore      │
└─────────────────────┘
```

### Settings Save Flow

```
User edits settings
        │
        ▼
┌───────────────────────┐
│  Validate inputs      │
│  (URL format, etc.)   │
└───────────┬───────────┘
            │ valid
            ▼
┌───────────────────────┐     ┌───────────────────────┐
│  Save to store        │     │  Save API key         │
│  (apiUrl, startup)    │     │  (if changed)         │
└───────────┬───────────┘     └───────────┬───────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐     ┌───────────────────────┐
│  Update autostart     │     │  Update keyring       │
│  (if startup changed) │     │  (set/delete)         │
└───────────┬───────────┘     └───────────┬───────────┘
            │                             │
            └──────────┬──────────────────┘
                       ▼
              ┌─────────────────┐
              │  Show success   │
              │  notification   │
              └─────────────────┘
```

## Validation Rules

### API URL

| Rule | Error Message |
|------|---------------|
| Must be valid URL | "Invalid URL format" |
| Protocol must be `http:` or `https:` | "URL must use HTTP or HTTPS" |
| Path must end with `/v1` | "URL must end with /v1" |
| Empty string is valid (clears setting) | N/A |

### API Key

| Rule | Error Message |
|------|---------------|
| Non-empty when provided | "API key cannot be empty" |
| Clear action removes from keychain | N/A |

## Relationships

```
┌──────────────────┐
│   AppSettings    │ ◄── Frontend Zustand store
│   (in-memory)    │
└────────┬─────────┘
         │ syncs with
         ▼
┌──────────────────┐      ┌──────────────────┐
│ PersistedSettings│      │ SecureCredential │
│ (app-settings.   │      │ (OS Keychain)    │
│  json)           │      │                  │
└──────────────────┘      └──────────────────┘
         │                         │
         │ autostart pref          │ api_key
         ▼                         │
┌──────────────────┐               │
│ OS Autostart     │               │
│ Registry         │               │
└──────────────────┘               │
                                   ▼
                          ┌──────────────────┐
                          │ LLM Bridge       │
                          │ (uses key for    │
                          │  API calls)      │
                          └──────────────────┘
```
