-- Update agent_configs table structure for enhanced configuration

-- Drop the old table and create new one with updated schema
DROP TABLE IF EXISTS agent_configs;

CREATE TABLE agent_configs (
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

CREATE INDEX IF NOT EXISTS idx_agent_configs_user_new ON agent_configs(user_id);
