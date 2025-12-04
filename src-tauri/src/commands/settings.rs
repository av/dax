//! Settings Commands
//!
//! Tauri commands for managing application settings, including secure API key storage
//! and autostart configuration.

use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "app-settings.json";
const KEYRING_SERVICE: &str = "dax";
const KEYRING_USER: &str = "api_key";

/// Response from get_app_settings command
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsResponse {
    pub api_url: String,
    pub has_api_key: bool,
    pub start_on_startup: bool,
}

/// Response from test_api_connection command
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
}

/// Retrieves all non-sensitive application settings.
#[tauri::command]
pub async fn get_app_settings(app: AppHandle) -> Result<AppSettingsResponse, String> {
    // Load settings from store
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let api_url = store
        .get("apiUrl")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default();

    // Check autostart status
    let autostart_manager = app.autolaunch();
    let start_on_startup = autostart_manager
        .is_enabled()
        .unwrap_or(false);

    // Check if API key exists in keychain (without retrieving it)
    let has_api_key = has_api_key_internal();

    Ok(AppSettingsResponse {
        api_url,
        has_api_key,
        start_on_startup,
    })
}

/// Saves non-sensitive application settings.
#[tauri::command]
pub async fn save_app_settings(
    app: AppHandle,
    api_url: String,
    start_on_startup: bool,
) -> Result<(), String> {
    // Validate API URL
    if !api_url.is_empty() {
        validate_api_url(&api_url)?;
    }

    // Save to store
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to load settings store: {}", e))?;

    store
        .set("apiUrl", serde_json::json!(api_url));

    store
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    // Update autostart
    let autostart_manager = app.autolaunch();
    let current_enabled = autostart_manager.is_enabled().unwrap_or(false);

    if start_on_startup != current_enabled {
        if start_on_startup {
            autostart_manager
                .enable()
                .map_err(|e| format!("Failed to enable autostart: {}", e))?;
        } else {
            autostart_manager
                .disable()
                .map_err(|e| format!("Failed to disable autostart: {}", e))?;
        }
    }

    Ok(())
}

/// Stores an API key in the OS keychain.
/// 
/// # Security
/// The API key is stored securely in the OS credential manager and never logged.
#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), String> {
    if key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    entry
        .set_password(&key)
        .map_err(|e| format!("Failed to store API key: {}", e))?;

    log::info!("API key stored successfully (value not logged for security)");
    Ok(())
}

/// Checks if an API key exists in the keychain (without retrieving it).
#[tauri::command]
pub fn has_api_key() -> Result<bool, String> {
    Ok(has_api_key_internal())
}

/// Internal function to check if API key exists.
/// Does not expose the actual key.
fn has_api_key_internal() -> bool {
    match Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        Ok(entry) => entry.get_password().is_ok(),
        Err(_) => false,
    }
}

/// Retrieves the API key from the OS keychain.
/// 
/// # Security
/// This is NOT a Tauri command. It should only be used internally by the LLM bridge.
/// The API key should never be sent to the frontend.
pub fn get_api_key_internal() -> Result<Option<String>, String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve API key: {}", e)),
    }
}

/// Removes the API key from the OS keychain.
#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    match entry.delete_credential() {
        Ok(_) => {
            log::info!("API key deleted successfully");
            Ok(())
        }
        Err(keyring::Error::NoEntry) => {
            // Not an error if key doesn't exist
            Ok(())
        }
        Err(e) => Err(format!("Failed to delete API key: {}", e)),
    }
}

/// Tests connectivity to the configured API endpoint.
/// If api_key is provided, uses it directly; otherwise retrieves from keychain.
#[tauri::command]
pub async fn test_api_connection(api_url: String, api_key: Option<String>) -> Result<TestConnectionResponse, String> {
    // Validate URL first
    validate_api_url(&api_url)?;

    // Use provided API key or fall back to stored key
    let api_key = match api_key {
        Some(key) if !key.is_empty() => key,
        _ => get_api_key_internal()?
            .ok_or_else(|| "No API key configured".to_string())?,
    };

    // Build the models endpoint URL
    let models_url = format!("{}/models", api_url);

    let client = reqwest::Client::new();
    let start = std::time::Instant::now();

    match client
        .get(&models_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as u64;

            if response.status().is_success() {
                Ok(TestConnectionResponse {
                    success: true,
                    message: "Connection successful".to_string(),
                    latency_ms: Some(latency_ms),
                })
            } else if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                Ok(TestConnectionResponse {
                    success: false,
                    message: "Invalid API key".to_string(),
                    latency_ms: Some(latency_ms),
                })
            } else {
                Ok(TestConnectionResponse {
                    success: false,
                    message: format!("Server returned error: {}", response.status()),
                    latency_ms: Some(latency_ms),
                })
            }
        }
        Err(e) => {
            if e.is_timeout() {
                Ok(TestConnectionResponse {
                    success: false,
                    message: "Connection timed out".to_string(),
                    latency_ms: None,
                })
            } else if e.is_connect() {
                Ok(TestConnectionResponse {
                    success: false,
                    message: "Could not connect to server".to_string(),
                    latency_ms: None,
                })
            } else {
                Ok(TestConnectionResponse {
                    success: false,
                    message: format!("Connection failed: {}", e),
                    latency_ms: None,
                })
            }
        }
    }
}

/// Validates that an API URL is properly formatted.
fn validate_api_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url)
        .map_err(|_| "Invalid URL format".to_string())?;

    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err("URL must use HTTP or HTTPS".to_string()),
    }

    if !parsed.path().ends_with("/v1") {
        return Err("URL must end with /v1".to_string());
    }

    Ok(())
}
