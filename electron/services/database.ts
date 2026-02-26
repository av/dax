import { app } from 'electron';
import path from 'path';
import { connect } from '@tursodatabase/database';

// ── Types ──────────────────────────────────────────

type TursoDB = Awaited<ReturnType<typeof connect>>;

// ── Schema ────────────────────────────────────────

const SCHEMA_V1 = `
CREATE TABLE workspaces (
  id              INTEGER PRIMARY KEY,
  path            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_opened_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE scene_objects (
  id            INTEGER PRIMARY KEY,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  object_type   TEXT NOT NULL,
  label         TEXT,
  visible       INTEGER NOT NULL DEFAULT 1,
  opacity       REAL NOT NULL DEFAULT 1.0,
  color_override TEXT,
  pos_x   REAL, pos_y   REAL, pos_z   REAL,
  rot_x   REAL, rot_y   REAL, rot_z   REAL, rot_w REAL,
  scale_x REAL NOT NULL DEFAULT 1.0,
  scale_y REAL NOT NULL DEFAULT 1.0,
  scale_z REAL NOT NULL DEFAULT 1.0,
  lin_vel_x REAL NOT NULL DEFAULT 0,
  lin_vel_y REAL NOT NULL DEFAULT 0,
  lin_vel_z REAL NOT NULL DEFAULT 0,
  ang_vel_x REAL NOT NULL DEFAULT 0,
  ang_vel_y REAL NOT NULL DEFAULT 0,
  ang_vel_z REAL NOT NULL DEFAULT 0,
  is_sleeping  INTEGER NOT NULL DEFAULT 1,
  is_pinned    INTEGER NOT NULL DEFAULT 0,
  mass         REAL,
  restitution  REAL,
  friction     REAL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_so_workspace ON scene_objects(workspace_id);
CREATE INDEX idx_so_type ON scene_objects(workspace_id, object_type);

CREATE TABLE entity_links (
  scene_object_id INTEGER PRIMARY KEY REFERENCES scene_objects(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       INTEGER NOT NULL
);
CREATE INDEX idx_el_entity ON entity_links(entity_type, entity_id);

CREATE TABLE files (
  id         INTEGER PRIMARY KEY,
  path       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  extension  TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE directories (
  id         INTEGER PRIMARY KEY,
  path       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE geometry_objects (
  scene_object_id INTEGER PRIMARY KEY REFERENCES scene_objects(id) ON DELETE CASCADE,
  geometry_type   TEXT NOT NULL,
  geometry_data   TEXT NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE spatial_relations (
  id               INTEGER PRIMARY KEY,
  workspace_id     INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_object_id INTEGER NOT NULL REFERENCES scene_objects(id) ON DELETE CASCADE,
  target_object_id INTEGER NOT NULL REFERENCES scene_objects(id) ON DELETE CASCADE,
  relation_type    TEXT NOT NULL,
  offset_x     REAL, offset_y     REAL, offset_z     REAL,
  offset_rot_x REAL, offset_rot_y REAL, offset_rot_z REAL, offset_rot_w REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_sr_source ON spatial_relations(source_object_id);
CREATE INDEX idx_sr_target ON spatial_relations(target_object_id);
CREATE INDEX idx_sr_type ON spatial_relations(workspace_id, relation_type);

CREATE TABLE attributes (
  id              INTEGER PRIMARY KEY,
  scene_object_id INTEGER NOT NULL REFERENCES scene_objects(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  value           TEXT NOT NULL,
  value_type      TEXT NOT NULL DEFAULT 'text',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (scene_object_id, key)
);
CREATE INDEX idx_attr_object ON attributes(scene_object_id);
CREATE INDEX idx_attr_key_value ON attributes(key, value);

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL,
  color TEXT
);

CREATE TABLE scene_object_tags (
  scene_object_id INTEGER NOT NULL REFERENCES scene_objects(id) ON DELETE CASCADE,
  tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (scene_object_id, tag_id)
);
CREATE INDEX idx_sot_tag ON scene_object_tags(tag_id);

CREATE TABLE file_embeddings (
  file_id      INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  model        TEXT NOT NULL,
  embedding    BLOB NOT NULL,
  embedded_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

const SCHEMA_V2 = `
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ── Migrations ────────────────────────────────────

async function runMigrations(db: TursoDB): Promise<void> {
  const raw = await db.prepare('PRAGMA user_version').get();
  const row = raw as unknown as Record<string, unknown>;
  const version = typeof row?.['user_version'] === 'number' ? row['user_version'] : 0;

  if (version < 1) {
    // exec() supports multi-statement SQL strings
    await db.exec(SCHEMA_V1);
    await db.prepare('PRAGMA user_version = 1').run();
  }

  if (version < 2) {
    await db.exec(SCHEMA_V2);
    await db.prepare('PRAGMA user_version = 2').run();
  }
}

// ── DatabaseService ───────────────────────────────

export class DatabaseService {
  private _db: TursoDB | null = null;

  get db(): TursoDB {
    if (!this._db) {
      throw new Error('DatabaseService: database is not initialized. Call initialize() first.');
    }
    return this._db;
  }

  async initialize(): Promise<void> {
    if (this._db) return;

    const dbPath = path.join(app.getPath('userData'), 'dax.db');
    this._db = await connect(dbPath);

    await runMigrations(this._db);
  }

  async close(): Promise<void> {
    if (!this._db) return;
    await this._db.close();
    this._db = null;
  }
}

// ── Singleton ─────────────────────────────────────

export const databaseService = new DatabaseService();
