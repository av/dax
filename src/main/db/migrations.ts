/**
 * Migration runner: version check + sequential apply.
 *
 * Uses a simple `schema_version` pragma-like approach via the app_config table itself.
 * Migrations are defined as SQL strings and applied sequentially.
 *
 * Pre-migration backup is handled for file-based databases.
 */
import type { TursoDB } from './index';
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

/** Current schema version. Increment when adding new migrations. */
const CURRENT_SCHEMA_VERSION = 1;

/** Max number of backup files to keep */
const MAX_BACKUPS = 5;

/**
 * All migrations in order. Each migration has a version and SQL statements.
 */
const MIGRATIONS: Array<{ version: number; description: string; sql: string[] }> = [
  {
    version: 1,
    description: 'Initial schema: all 7 tables',
    sql: [
      // app_config
      `CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // scene_objects
      `CREATE TABLE IF NOT EXISTS scene_objects (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        parent_path TEXT,
        type TEXT NOT NULL,
        position_x REAL NOT NULL DEFAULT 0,
        position_y REAL NOT NULL DEFAULT 0,
        position_z REAL NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_scene_objects_path ON scene_objects(path)`,
      `CREATE INDEX IF NOT EXISTS idx_scene_objects_parent_path ON scene_objects(parent_path)`,

      // agent_state
      `CREATE TABLE IF NOT EXISTS agent_state (
        id TEXT PRIMARY KEY,
        beliefs TEXT NOT NULL,
        desires TEXT NOT NULL,
        current_intention TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        position_x REAL NOT NULL DEFAULT 0,
        position_z REAL NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`,

      // agent_instructions
      `CREATE TABLE IF NOT EXISTS agent_instructions (
        id TEXT PRIMARY KEY,
        trigger_pattern TEXT NOT NULL,
        action_description TEXT NOT NULL,
        embedding BLOB,
        confidence REAL NOT NULL DEFAULT 1.0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        last_used INTEGER,
        is_user_created INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_instructions_trigger ON agent_instructions(trigger_pattern)`,
      `CREATE INDEX IF NOT EXISTS idx_instructions_usage ON agent_instructions(usage_count, last_used)`,

      // agent_action_log
      `CREATE TABLE IF NOT EXISTS agent_action_log (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        target_path TEXT,
        parameters TEXT,
        result TEXT NOT NULL,
        error_message TEXT,
        intention_id TEXT,
        instruction_id TEXT REFERENCES agent_instructions(id),
        belief_snapshot TEXT,
        duration_ms INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS idx_action_log_timestamp ON agent_action_log(timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_action_log_type ON agent_action_log(action_type)`,
      `CREATE INDEX IF NOT EXISTS idx_action_log_intention ON agent_action_log(intention_id)`,

      // chat_messages
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        session_id TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp)`,

      // keyboard_shortcuts
      `CREATE TABLE IF NOT EXISTS keyboard_shortcuts (
        action TEXT PRIMARY KEY,
        key_combo TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 1
      )`,

      // Store schema version in app_config
      `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('schema_version', '1', ${Date.now()})`,
    ],
  },
];

/**
 * Get the current schema version from the database.
 * Returns 0 if the schema_version key doesn't exist (fresh DB).
 */
async function getSchemaVersion(db: TursoDB): Promise<number> {
  try {
    // Check if app_config table exists
    const tableCheck = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_config'")
      .get();

    if (!tableCheck) return 0;

    const row = await db
      .prepare("SELECT value FROM app_config WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;

    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Create a backup of the database file before running migrations.
 * Only applies to file-based databases (not :memory:).
 */
function backupDatabase(dbPath: string): void {
  if (dbPath === ':memory:' || !existsSync(dbPath)) return;

  const backupDir = join(dirname(dbPath), 'backups');
  mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `dax_v${CURRENT_SCHEMA_VERSION}_backup_${timestamp}.db`);

  copyFileSync(dbPath, backupPath);

  // Clean up old backups (keep only MAX_BACKUPS most recent)
  try {
    const { readdirSync, unlinkSync } = require('fs') as typeof import('fs');
    const files = readdirSync(backupDir)
      .filter((f: string) => f.startsWith('dax_v') && f.endsWith('.db'))
      .sort()
      .reverse();

    for (let i = MAX_BACKUPS; i < files.length; i++) {
      unlinkSync(join(backupDir, files[i]));
    }
  } catch {
    // Non-critical: backup cleanup failure is not fatal
  }
}

/**
 * Run all pending migrations.
 * Checks current schema version and applies any migrations with a higher version number.
 */
export async function runMigrations(db: TursoDB, dbPath?: string): Promise<void> {
  const currentVersion = await getSchemaVersion(db);

  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return; // Already up to date
  }

  // Backup before migrating (only for file-based DBs)
  if (dbPath) {
    backupDatabase(dbPath);
  }

  // Apply pending migrations
  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion);

  for (const migration of pendingMigrations) {
    for (const sql of migration.sql) {
      await db.prepare(sql).run();
    }
  }
}
