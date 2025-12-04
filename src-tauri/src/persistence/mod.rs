pub mod schema;

use crate::models::workspace::Workspace;
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, Row};
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database error: {0}")]
    SqlxError(#[from] sqlx::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Workspace not found")]
    WorkspaceNotFound,
}

pub type DbResult<T> = Result<T, DbError>;

pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new(db_path: &Path) -> DbResult<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await?;

        let db = Self { pool };
        db.initialize().await?;

        Ok(db)
    }

    async fn initialize(&self) -> DbResult<()> {
        sqlx::query(schema::SCHEMA).execute(&self.pool).await?;
        Ok(())
    }

    pub fn pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }

    /// Save workspace to database
    pub async fn save_workspace(&self, workspace: &Workspace) -> DbResult<()> {
        let metadata_json = serde_json::to_string(&workspace.metadata)?;
        let objects_json = serde_json::to_string(&workspace.objects)?;
        let boundaries_json = serde_json::to_string(&workspace.boundaries)?;
        let beacons_json = serde_json::to_string(&workspace.beacons)?;
        let snippets_json = serde_json::to_string(&workspace.snippets)?;
        let camera_json = workspace.camera_state.as_ref()
            .map(|c| serde_json::to_string(c))
            .transpose()?;
        let settings_json = workspace.settings.as_ref()
            .map(|s| serde_json::to_string(s))
            .transpose()?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO workspaces (
                id, metadata, objects, boundaries, beacons, snippets, camera_state, settings, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
            )
            "#
        )
        .bind(&workspace.metadata.id)
        .bind(&metadata_json)
        .bind(&objects_json)
        .bind(&boundaries_json)
        .bind(&beacons_json)
        .bind(&snippets_json)
        .bind(&camera_json)
        .bind(&settings_json)
        .bind(chrono::Utc::now().timestamp_millis())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Load workspace from database
    pub async fn load_workspace(&self) -> DbResult<Workspace> {
        let row = sqlx::query(
            "SELECT metadata, objects, boundaries, beacons, snippets, camera_state, settings FROM workspaces LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => {
                let metadata_str: String = row.get("metadata");
                let objects_str: String = row.get("objects");
                let boundaries_str: String = row.get("boundaries");
                let beacons_str: String = row.get("beacons");
                let snippets_str: String = row.get("snippets");
                let camera_str: Option<String> = row.get("camera_state");
                let settings_str: Option<String> = row.get("settings");

                Ok(Workspace {
                    metadata: serde_json::from_str(&metadata_str)?,
                    objects: serde_json::from_str(&objects_str)?,
                    boundaries: serde_json::from_str(&boundaries_str)?,
                    beacons: serde_json::from_str(&beacons_str)?,
                    snippets: serde_json::from_str(&snippets_str)?,
                    camera_state: camera_str.map(|s| serde_json::from_str(&s)).transpose()?,
                    settings: settings_str.map(|s| serde_json::from_str(&s)).transpose()?,
                })
            }
            None => Err(DbError::WorkspaceNotFound),
        }
    }

    pub async fn close(&self) {
        self.pool.close().await;
    }
}
