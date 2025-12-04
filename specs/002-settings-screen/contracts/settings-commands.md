# Contract: Settings Tauri Commands

**Feature**: 002-settings-screen  
**Date**: 2025-12-04

## Overview

Tauri commands for managing application settings, including secure API key storage and autostart configuration.

---

## Commands

### `get_app_settings`

Retrieves all non-sensitive application settings.

**Signature**:
```rust
#[tauri::command]
pub async fn get_app_settings(app: AppHandle) -> Result<AppSettingsResponse, String>
```

**Request**: None

**Response**:
```typescript
interface AppSettingsResponse {
  apiUrl: string;
  hasApiKey: boolean;
  startOnStartup: boolean;
}
```

**Errors**:
- `"Failed to load settings: {details}"` - Store access error

---

### `save_app_settings`

Saves non-sensitive application settings.

**Signature**:
```rust
#[tauri::command]
pub async fn save_app_settings(
    app: AppHandle,
    api_url: String,
    start_on_startup: bool
) -> Result<(), String>
```

**Request**:
```typescript
interface SaveAppSettingsRequest {
  apiUrl: string;
  startOnStartup: boolean;
}
```

**Response**: `void` on success

**Errors**:
- `"Invalid API URL: {details}"` - URL validation failed
- `"Failed to save settings: {details}"` - Store write error
- `"Failed to update autostart: {details}"` - Autostart registration error

---

### `set_api_key`

Stores an API key in the OS keychain.

**Signature**:
```rust
#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), String>
```

**Request**:
```typescript
interface SetApiKeyRequest {
  key: string;
}
```

**Response**: `void` on success

**Errors**:
- `"API key cannot be empty"` - Empty key provided
- `"Failed to store API key: {details}"` - Keychain access error

---

### `has_api_key`

Checks if an API key exists in the keychain (without retrieving it).

**Signature**:
```rust
#[tauri::command]
pub fn has_api_key() -> Result<bool, String>
```

**Request**: None

**Response**: `boolean` - `true` if key exists

**Errors**:
- `"Failed to check API key: {details}"` - Keychain access error

---

### `delete_api_key`

Removes the API key from the OS keychain.

**Signature**:
```rust
#[tauri::command]
pub fn delete_api_key() -> Result<(), String>
```

**Request**: None

**Response**: `void` on success

**Errors**:
- `"Failed to delete API key: {details}"` - Keychain access error

---

### `get_api_key`

Retrieves the API key from the OS keychain. **Internal use only** - called by LLM bridge, not exposed to frontend.

**Signature**:
```rust
pub fn get_api_key_internal() -> Result<Option<String>, String>
```

**Note**: This is NOT a Tauri command. The API key should never be sent to the frontend. It's used internally by the LLM command handlers.

---

### `test_api_connection`

Tests connectivity to the configured API endpoint.

**Signature**:
```rust
#[tauri::command]
pub async fn test_api_connection(api_url: String) -> Result<TestConnectionResponse, String>
```

**Request**:
```typescript
interface TestConnectionRequest {
  apiUrl: string;
}
```

**Response**:
```typescript
interface TestConnectionResponse {
  success: boolean;
  message: string;
  latencyMs?: number;
}
```

**Errors**:
- `"Invalid API URL"` - URL validation failed
- `"Connection failed: {details}"` - Network error

---

## Frontend Service Interface

```typescript
// services/settings.ts

export interface AppSettings {
  apiUrl: string;
  hasApiKey: boolean;
  startOnStartup: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export async function getAppSettings(): Promise<AppSettings>;
export async function saveAppSettings(apiUrl: string, startOnStartup: boolean): Promise<void>;
export async function setApiKey(key: string): Promise<void>;
export async function hasApiKey(): Promise<boolean>;
export async function deleteApiKey(): Promise<void>;
export async function testApiConnection(apiUrl: string): Promise<TestConnectionResult>;
```

---

## Security Considerations

1. **API Key Never in Frontend**: The actual API key value is never returned to the JavaScript frontend. Only `hasApiKey: boolean` is exposed.

2. **Logging**: API key must never be logged. All Rust functions handling the key must avoid `log!` or `println!` with key values.

3. **Memory**: Consider zeroing memory after use (though Rust's `String` makes this difficult without `zeroize` crate).

4. **Keychain Service Name**: Use `dax` as the service name and `api_key` as the user/account name for keychain entries.
