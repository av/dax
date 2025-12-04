pub const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    metadata TEXT NOT NULL,
    objects TEXT NOT NULL DEFAULT '[]',
    boundaries TEXT NOT NULL DEFAULT '[]',
    beacons TEXT NOT NULL DEFAULT '[]',
    snippets TEXT NOT NULL DEFAULT '[]',
    camera_state TEXT,
    settings TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_objects_workspace ON objects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_objects_type ON objects(type);

CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data_json TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_workspace ON agent_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_timestamp ON agent_messages(timestamp);

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    priority INTEGER NOT NULL,
    progress REAL NOT NULL,
    result_json TEXT,
    reasoning TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goals_workspace ON goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

CREATE TABLE IF NOT EXISTS file_watches (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    object_id TEXT NOT NULL,
    FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
);
"#;
