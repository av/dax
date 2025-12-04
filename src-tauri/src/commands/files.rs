use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter};
use tokio::sync::Mutex;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};

use crate::models::FileCategory;

// Global file watcher state - stores watch IDs and their unwatch flags
lazy_static::lazy_static! {
    static ref WATCH_ACTIVE: Arc<Mutex<HashMap<String, bool>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeEvent {
    pub path: String,
    pub change_type: String, // "modified", "removed", "renamed"
    pub new_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub is_readable: bool,
    pub is_writable: bool,
    pub last_modified: u64,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub text: Option<String>,
    pub binary: Option<Vec<u8>>,
    pub encoding: String,
}

fn category_to_string(cat: &FileCategory) -> String {
    match cat {
        FileCategory::Text => "text",
        FileCategory::Code => "code",
        FileCategory::Image => "image",
        FileCategory::Document => "document",
        FileCategory::Data => "data",
        FileCategory::Archive => "archive",
        FileCategory::Media => "media",
        FileCategory::Unknown => "unknown",
    }
    .to_string()
}

#[command]
pub async fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let path_buf = PathBuf::from(&path);

    let metadata = std::fs::metadata(&path_buf).map_err(|e| e.to_string())?;

    let name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = path_buf
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    let category = FileCategory::from_extension(&extension);

    let mime_type = mime_guess::from_path(&path_buf)
        .first_or_octet_stream()
        .to_string();

    let last_modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let is_readable = !metadata.permissions().readonly();

    Ok(FileMetadata {
        path,
        name,
        extension,
        size_bytes: metadata.len(),
        mime_type,
        is_readable,
        is_writable: is_readable,
        last_modified,
        category: category_to_string(&category),
    })
}

#[command]
pub async fn read_file(path: String) -> Result<FileContent, String> {
    let path_buf = PathBuf::from(&path);
    let extension = path_buf
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    let category = FileCategory::from_extension(&extension);

    match category {
        FileCategory::Text | FileCategory::Code => {
            let content = std::fs::read_to_string(&path_buf).map_err(|e| e.to_string())?;
            Ok(FileContent {
                text: Some(content),
                binary: None,
                encoding: "utf-8".to_string(),
            })
        }
        _ => {
            let content = std::fs::read(&path_buf).map_err(|e| e.to_string())?;
            Ok(FileContent {
                text: None,
                binary: Some(content),
                encoding: "binary".to_string(),
            })
        }
    }
}

#[command]
pub async fn write_file(path: String, content: String, create_dirs: bool) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    if create_dirs {
        if let Some(parent) = path_buf.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    std::fs::write(&path_buf, content).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePreview {
    #[serde(rename = "type")]
    pub preview_type: String,
    pub data: Option<String>,
    pub mime_type: Option<String>,
}

#[command]
pub async fn generate_preview(
    path: String,
    max_width: Option<u32>,
    max_height: Option<u32>,
    text_lines: Option<usize>,
) -> Result<FilePreview, String> {
    let path_buf = PathBuf::from(&path);
    let extension = path_buf
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let category = FileCategory::from_extension(&extension);
    let mime_type = mime_guess::from_path(&path_buf)
        .first_or_octet_stream()
        .to_string();

    match category {
        FileCategory::Text | FileCategory::Code => {
            // Generate text excerpt
            let lines = text_lines.unwrap_or(10);
            let content = std::fs::read_to_string(&path_buf).map_err(|e| e.to_string())?;
            let excerpt: String = content
                .lines()
                .take(lines)
                .collect::<Vec<_>>()
                .join("\n");
            
            Ok(FilePreview {
                preview_type: "text".to_string(),
                data: Some(excerpt),
                mime_type: Some(mime_type),
            })
        }
        FileCategory::Image => {
            // Read image and encode as base64
            // For now, just return the raw image as base64 (full size)
            // In a full implementation, we would resize using an image processing library
            let _max_w = max_width.unwrap_or(256);
            let _max_h = max_height.unwrap_or(256);
            
            let content = std::fs::read(&path_buf).map_err(|e| e.to_string())?;
            let base64_content = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                &content,
            );
            
            Ok(FilePreview {
                preview_type: "thumbnail".to_string(),
                data: Some(base64_content),
                mime_type: Some(mime_type),
            })
        }
        _ => {
            // No preview available for other file types
            Ok(FilePreview {
                preview_type: "none".to_string(),
                data: None,
                mime_type: Some(mime_type),
            })
        }
    }
}

#[command]
pub async fn watch_file(app: AppHandle, path: String) -> Result<(), String> {
    let path_clone = path.clone();
    let path_for_watcher = path.clone();
    let app_clone = app.clone();
    
    // Check if already watching this file
    {
        let watches = WATCH_ACTIVE.lock().await;
        if watches.contains_key(&path) {
            return Ok(()); // Already watching
        }
    }
    
    // Mark as active
    {
        let mut watches = WATCH_ACTIVE.lock().await;
        watches.insert(path.clone(), true);
    }
    
    // Spawn the watcher in a background task
    tauri::async_runtime::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<notify::Result<Event>>(100);
        
        // Create the file watcher
        let mut watcher = match RecommendedWatcher::new(
            move |res: notify::Result<Event>| {
                let _ = tx.blocking_send(res);
            },
            Config::default(),
        ) {
            Ok(w) => w,
            Err(e) => {
                log::error!("Failed to create watcher: {}", e);
                return;
            }
        };
        
        // Start watching the file
        let path_buf = PathBuf::from(&path_for_watcher);
        if let Err(e) = watcher.watch(&path_buf, RecursiveMode::NonRecursive) {
            log::error!("Failed to watch file: {}", e);
            return;
        }
        
        log::info!("Started watching file: {}", path_for_watcher);
        
        // Process events until stopped
        loop {
            // Check if still active
            {
                let watches = WATCH_ACTIVE.lock().await;
                match watches.get(&path_clone) {
                    Some(true) => {} // Still active
                    _ => {
                        log::info!("Stopped watching file: {}", path_clone);
                        break;
                    }
                }
            }
            
            // Wait for events with timeout
            match tokio::time::timeout(
                tokio::time::Duration::from_millis(500),
                rx.recv()
            ).await {
                Ok(Some(result)) => {
                    match result {
                        Ok(event) => {
                            let change_type = match event.kind {
                                notify::EventKind::Modify(_) => "modified",
                                notify::EventKind::Remove(_) => "removed",
                                notify::EventKind::Create(_) => "created",
                                _ => continue, // Ignore other events
                            };
                            
                            for event_path in event.paths {
                                if event_path.to_string_lossy() == path_clone {
                                    let file_event = FileChangeEvent {
                                        path: path_clone.clone(),
                                        change_type: change_type.to_string(),
                                        new_path: None,
                                    };
                                    
                                    let _ = app_clone.emit("file-changed", file_event);
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("File watcher error: {}", e);
                        }
                    }
                }
                Ok(None) => {
                    // Channel closed
                    break;
                }
                Err(_) => {
                    // Timeout - continue checking
                    continue;
                }
            }
        }
    });
    
    Ok(())
}

#[command]
pub async fn unwatch_file(path: String) -> Result<(), String> {
    let mut watches = WATCH_ACTIVE.lock().await;
    watches.remove(&path);
    Ok(())
}

#[command]
pub async fn save_file(path: String, content: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    std::fs::write(&path_buf, content).map_err(|e| format!("Failed to save file: {}", e))
}
