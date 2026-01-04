-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user', 'viewer')),
  permissions TEXT NOT NULL, -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Canvas nodes table
CREATE TABLE IF NOT EXISTS canvas_nodes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('data', 'agent', 'transform', 'output')),
  title TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  data TEXT, -- JSON
  config TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- RDF Entities table
CREATE TABLE IF NOT EXISTS rdf_entities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  attributes TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- RDF Links table
CREATE TABLE IF NOT EXISTS rdf_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  from_entity TEXT NOT NULL,
  to_entity TEXT NOT NULL,
  type TEXT NOT NULL,
  properties TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (from_entity) REFERENCES rdf_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (to_entity) REFERENCES rdf_entities(id) ON DELETE CASCADE
);

-- Preferences table
CREATE TABLE IF NOT EXISTS preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL CHECK(theme IN ('light', 'dark', 'system')),
  autostart INTEGER NOT NULL DEFAULT 0,
  data_dir TEXT NOT NULL,
  backup_enabled INTEGER NOT NULL DEFAULT 0,
  backup_interval INTEGER NOT NULL,
  backup_location TEXT NOT NULL,
  sync_enabled INTEGER NOT NULL DEFAULT 0,
  sync_provider TEXT,
  sync_config TEXT, -- JSON
  language TEXT NOT NULL,
  hotkeys TEXT NOT NULL, -- JSON
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ACL (Access Control List) table
CREATE TABLE IF NOT EXISTS acl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('canvas_node', 'rdf_entity', 'document')),
  user_id TEXT NOT NULL,
  permissions TEXT NOT NULL, -- JSON array of permissions
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(resource_id, resource_type, user_id)
);

-- Documents table (for generic data storage)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Agent configurations table
CREATE TABLE IF NOT EXISTS agent_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  icon_type TEXT NOT NULL CHECK(icon_type IN ('lucide', 'emoji')),
  api_url TEXT NOT NULL,
  api_key TEXT,
  headers TEXT, -- JSON
  query_params TEXT, -- JSON
  extra_body TEXT, -- JSON
  preset TEXT CHECK(preset IN ('openai', 'openrouter', 'anthropic', 'custom')),
  temperature REAL,
  max_tokens INTEGER,
  tools TEXT, -- JSON array
  system_prompt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- History/Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_user ON canvas_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_type ON canvas_nodes(type);
CREATE INDEX IF NOT EXISTS idx_rdf_entities_user ON rdf_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_rdf_entities_type ON rdf_entities(type);
CREATE INDEX IF NOT EXISTS idx_rdf_links_user ON rdf_links(user_id);
CREATE INDEX IF NOT EXISTS idx_rdf_links_from ON rdf_links(from_entity);
CREATE INDEX IF NOT EXISTS idx_rdf_links_to ON rdf_links(to_entity);
CREATE INDEX IF NOT EXISTS idx_acl_resource ON acl(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_acl_user ON acl(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agent_configs_user ON agent_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource ON activity_log(resource_type, resource_id);

-- Full-text search indexes for semantic search
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED,
  data,
  content=documents,
  content_rowid=rowid
);

CREATE VIRTUAL TABLE IF NOT EXISTS canvas_nodes_fts USING fts5(
  id UNINDEXED,
  title,
  data,
  content=canvas_nodes,
  content_rowid=rowid
);
