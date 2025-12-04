use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use super::Vector3;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileCategory {
    Text,
    Code,
    Image,
    Document,
    Data,
    Archive,
    Media,
    Unknown,
}

impl FileCategory {
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "txt" | "md" | "markdown" | "json" | "xml" | "yaml" | "yml" | "toml" | "ini"
            | "cfg" | "conf" | "log" => FileCategory::Text,

            "ts" | "tsx" | "js" | "jsx" | "rs" | "py" | "go" | "java" | "c" | "cpp" | "h"
            | "hpp" | "cs" | "rb" | "php" | "swift" | "kt" | "scala" | "sh" | "bash" | "zsh"
            | "fish" | "ps1" | "vue" | "svelte" | "html" | "css" | "scss" | "sass" | "less" => {
                FileCategory::Code
            }

            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "tiff" | "psd"
            | "ai" | "raw" | "heic" | "avif" => FileCategory::Image,

            "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" | "odp"
            | "rtf" | "tex" | "epub" => FileCategory::Document,

            "csv" | "tsv" | "parquet" | "sql" | "db" | "sqlite" | "mdb" | "accdb" | "ndjson"
            | "jsonl" => FileCategory::Data,

            "zip" | "tar" | "gz" | "bz2" | "xz" | "7z" | "rar" | "tgz" | "tbz2" => {
                FileCategory::Archive
            }

            "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" | "mp4" | "mkv" | "avi"
            | "mov" | "wmv" | "flv" | "webm" | "m4v" => FileCategory::Media,

            _ => FileCategory::Unknown,
        }
    }

    pub fn is_editable(&self) -> bool {
        matches!(self, FileCategory::Text | FileCategory::Code)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FileObject {
    pub id: String,
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    pub category: FileCategory,
    pub size_bytes: u64,
    pub mime_type: String,
    pub is_editable: bool,
    pub last_modified: u64,
    pub position: Vector3,
    pub rotation: Vector3,
    pub created_at: u64,
    pub updated_at: u64,
}

impl FileObject {
    pub fn new(id: String, path: PathBuf) -> Self {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let extension = path
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();

        let category = FileCategory::from_extension(&extension);
        let is_editable = category.is_editable();
        let mime_type = mime_guess::from_path(&path)
            .first_or_octet_stream()
            .to_string();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            id,
            path,
            name,
            extension,
            category,
            size_bytes: 0,
            mime_type,
            is_editable,
            last_modified: now,
            position: Vector3::zero(),
            rotation: Vector3::zero(),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn with_metadata(mut self, size_bytes: u64, last_modified: u64) -> Self {
        self.size_bytes = size_bytes;
        self.last_modified = last_modified;
        self
    }

    pub fn with_position(mut self, position: Vector3) -> Self {
        self.position = position;
        self
    }
}
