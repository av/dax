# Scene Persistence — Design Spec

## Overview

This document covers two closely related areas:

1. **Bug fix** — file objects placed in the air when the camera moves away and returns
2. **Scene persistence** — durable storage of the full 3D scene state (positions, physics,
   relations, tags, attributes, embeddings) across sessions, using Turso DB as the storage
   engine

---

## Part 1 — Bug Fix: Bodies Placed in Air on Camera Return

### Root Cause

`FileInstances.tsx` uses a LOD system that disables Rapier physics bodies when they exceed
`lodBillboard` distance from the camera, and re-enables them when the camera returns within
`lodBillboardInner`. The re-enable path unconditionally teleports each body to
`targetPos[1] + 2` (two units above the computed layout position):

```ts
body.setTranslation({ x: targetPos[0], y: targetPos[1] + 2, z: targetPos[2] }, true);
```

The `+ 2` offset was intended for first-spawn only (so cards drop gracefully onto platforms),
but applying it on every re-enable discards the body's already-settled resting position,
causing the "placed in the air" effect every time the camera returns.

### Fix

Before disabling a body for LOD, snapshot its exact `body.translation()` and
`body.rotation()` into a `Map<string, {x, y, z, rx, ry, rz, rw}>` ref keyed by file ID.
When re-enabling, restore from that snapshot (with zeroed velocities) instead of using
`targetPos + 2`. The `+ 2` spawn offset stays only in the `instances` useMemo
(first-render only), which is the correct intent.

---

## Part 2 — Scene Persistence

### Storage Engine

**Turso DB** (`@tursodatabase/database`, WASM variant) — avoids Electron native addon
rebuild issues, runs in-process in the main process, sub-microsecond read/write latency,
full SQLite compatibility, built-in vector search.

A single database file lives at:

```
app.getPath('userData')/dax.db
```

One database for the entire application; all workspaces are separated by `workspace_id`
foreign keys. No per-workspace files to manage.

Schema version is tracked via `PRAGMA user_version`. All schema changes are implemented as
numbered migration functions that run at startup.

---

## Part 3 — Schema Design

### Design Principles

- **`scene_objects` is the universal 3D primitive.** Everything placed in the workspace —
  file cards, directory platforms, boundary boxes, meshes, paths, annotations — is first a
  `scene_object`. Domain entities (files, directories) link *into* scene objects, not the
  other way around.
- **Spatial relations, attributes, tags, and physics all operate on `scene_objects`**
  regardless of what the object represents.
- **The same file in two workspaces** produces two independent `scene_objects` rows with
  independent transforms, physics state, attributes, and tags.
- **New object types** (e.g. sticky note, audio visualiser) require only a new
  `object_type` string value and optionally a new domain table — no schema migration needed.
- **`geometry_objects.geometry_data`** is JSON so shape parameters can evolve freely;
  stable types can later be promoted to typed columns.

---

### Full Schema

```sql
-- ── Schema version ────────────────────────────────────────────
PRAGMA user_version = 1;

-- ── Workspaces ────────────────────────────────────────────────
CREATE TABLE workspaces (
  id              INTEGER PRIMARY KEY,
  path            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_opened_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Scene objects — universal 3D primitive ────────────────────
-- One row per object placed in the scene, regardless of type.
CREATE TABLE scene_objects (
  id            INTEGER PRIMARY KEY,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  object_type   TEXT NOT NULL,
  -- 'file' | 'directory' | 'box' | 'mesh' | 'path' | 'annotation' | ...

  label         TEXT,          -- display name override (NULL = derive from linked entity)
  visible       INTEGER NOT NULL DEFAULT 1,
  opacity       REAL    NOT NULL DEFAULT 1.0,
  color_override TEXT,         -- hex colour, NULL = use type default

  -- Full rigid-body transform
  pos_x   REAL, pos_y   REAL, pos_z   REAL,
  rot_x   REAL, rot_y   REAL, rot_z   REAL, rot_w REAL,
  scale_x REAL NOT NULL DEFAULT 1.0,
  scale_y REAL NOT NULL DEFAULT 1.0,
  scale_z REAL NOT NULL DEFAULT 1.0,

  -- Physics state snapshot (captured at save time for faithful restore)
  lin_vel_x REAL NOT NULL DEFAULT 0,
  lin_vel_y REAL NOT NULL DEFAULT 0,
  lin_vel_z REAL NOT NULL DEFAULT 0,
  ang_vel_x REAL NOT NULL DEFAULT 0,
  ang_vel_y REAL NOT NULL DEFAULT 0,
  ang_vel_z REAL NOT NULL DEFAULT 0,
  is_sleeping  INTEGER NOT NULL DEFAULT 1,
  -- 1 = settled: spawn as Fixed, immediately transition to Dynamic (lands instantly)
  -- 0 = in-flight: spawn as Dynamic with saved velocities restored
  is_pinned    INTEGER NOT NULL DEFAULT 0,
  -- 1 = Fixed body permanently (user-pinned)

  -- Physics material overrides (NULL = world defaults)
  mass         REAL,
  restitution  REAL,
  friction     REAL,

  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_so_workspace ON scene_objects(workspace_id);
CREATE INDEX idx_so_type      ON scene_objects(workspace_id, object_type);

-- ── Entity links — polymorphic bridge to domain entities ──────
-- Geometry-only objects (boxes, paths, annotations) have no row here.
CREATE TABLE entity_links (
  scene_object_id INTEGER PRIMARY KEY REFERENCES scene_objects(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  -- 'file' | 'directory' | (future: 'note', 'asset', ...)
  entity_id       INTEGER NOT NULL
  -- FK into files.id, directories.id, etc. — not enforced at DB level
  -- due to polymorphism; enforced at application level
);
CREATE INDEX idx_el_entity ON entity_links(entity_type, entity_id);

-- ── Files — domain entity ─────────────────────────────────────
CREATE TABLE files (
  id         INTEGER PRIMARY KEY,
  path       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  extension  TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Directories — domain entity ───────────────────────────────
CREATE TABLE directories (
  id         INTEGER PRIMARY KEY,
  path       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Geometry objects — shape data for non-entity scene objects ─
-- geometry_data is JSON so each shape type can evolve independently.
-- Examples:
--   box        → {"width": 4, "height": 2, "depth": 3}
--   sphere     → {"radius": 1.5}
--   path       → {"points": [[x,y,z], ...], "closed": false}
--   mesh       → {"vertices": [...], "indices": [...]}
--   annotation → {"text": "...", "fontSize": 14}
CREATE TABLE geometry_objects (
  scene_object_id INTEGER PRIMARY KEY REFERENCES scene_objects(id) ON DELETE CASCADE,
  geometry_type   TEXT NOT NULL,   -- 'box' | 'sphere' | 'path' | 'mesh' | 'annotation'
  geometry_data   TEXT NOT NULL,   -- JSON
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Spatial relations — between scene objects ─────────────────
-- Captures semantic and structural relationships between any two scene objects,
-- independent of their underlying entity type.
--
-- Relation types (extensible string enum):
--   'stacked_on'      — source rests on top of target
--   'grouped_with'    — loose visual grouping
--   'pinned_to'       — source maintains fixed offset from target
--   'contained_by'    — source is logically inside target (e.g. inside a boundary box)
--   'connected_to'    — abstract edge (graph visualisation)
CREATE TABLE spatial_relations (
  id               INTEGER PRIMARY KEY,
  workspace_id     INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_object_id INTEGER NOT NULL REFERENCES scene_objects(id) ON DELETE CASCADE,
  target_object_id INTEGER NOT NULL REFERENCES scene_objects(id) ON DELETE CASCADE,
  relation_type    TEXT NOT NULL,

  -- Optional relative transform: source expressed in target's local space.
  -- Used for 'pinned_to' and 'stacked_on' to maintain position during movement.
  offset_x     REAL, offset_y     REAL, offset_z     REAL,
  offset_rot_x REAL, offset_rot_y REAL, offset_rot_z REAL, offset_rot_w REAL,

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_sr_source  ON spatial_relations(source_object_id);
CREATE INDEX idx_sr_target  ON spatial_relations(target_object_id);
CREATE INDEX idx_sr_type    ON spatial_relations(workspace_id, relation_type);

-- ── Attributes — typed key-value store on scene objects ────────
-- Used for internal engine properties and user-defined metadata.
-- value_type enables typed filtering without casting:
--   'text' | 'int' | 'real' | 'bool' | 'json'
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
CREATE INDEX idx_attr_object    ON attributes(scene_object_id);
CREATE INDEX idx_attr_key_value ON attributes(key, value);  -- global filter by attribute

-- ── Tags ──────────────────────────────────────────────────────
CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL,
  color TEXT
);

-- Tags are applied to scene objects (workspace-scoped by the object's workspace_id).
-- Same file in two workspaces can carry different tags independently.
CREATE TABLE scene_object_tags (
  scene_object_id INTEGER NOT NULL REFERENCES scene_objects(id) ON DELETE CASCADE,
  tag_id          INTEGER NOT NULL REFERENCES tags(id)          ON DELETE CASCADE,
  PRIMARY KEY (scene_object_id, tag_id)
);
CREATE INDEX idx_sot_tag ON scene_object_tags(tag_id);

-- ── File embeddings ───────────────────────────────────────────
-- Stored on the global file entity (not per workspace_file), since the
-- content and its embedding are workspace-independent.
-- model column allows re-embedding with a new model without losing old vectors.
CREATE TABLE file_embeddings (
  file_id      INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  model        TEXT NOT NULL,
  embedding    BLOB NOT NULL,          -- vector32(N) via Turso vector search
  embedded_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
```

---

## Part 4 — IPC Surface

All handlers live in `electron/ipc/workspace.ts` under the `workspace:` namespace,
registered via `registerWorkspaceHandlers()` in `electron/main.ts`.

| Channel | Direction | Payload |
|---|---|---|
| `workspace:open` | invoke | `{path, name}` → `{workspaceId}` |
| `workspace:loadScene` | invoke | `{workspaceId}` → `SceneSnapshot` |
| `workspace:saveScene` | invoke | `{workspaceId, objects, relations}` → `void` |
| `workspace:upsertAttributes` | invoke | `{sceneObjectId, attrs}` → `void` |
| `workspace:loadAttributes` | invoke | `{sceneObjectId}` → `Attribute[]` |
| `workspace:saveTags` | invoke | `{sceneObjectId, tagIds}` → `void` |
| `workspace:loadTags` | invoke | `{workspaceId}` → `TaggedObject[]` |
| `workspace:saveEmbedding` | invoke | `{fileId, model, vector}` → `void` |
| `workspace:searchByEmbedding` | invoke | `{vector, limit?}` → `{fileId, distance}[]` |

`SceneSnapshot` carries the full denormalised payload the renderer needs to reconstruct the
scene: `scene_objects` rows joined with `entity_links`, `geometry_objects`,
`spatial_relations`, `attributes`, and resolved `files`/`directories` paths — one round trip.

---

## Part 5 — Renderer Integration

### Load sequence (on workspace open)

1. `workspace:open` — upsert workspace row, receive `workspaceId`
2. `workspace:loadScene` — receive `SceneSnapshot`
3. Populate `fileTreeStore.positionOverrides` from snapshot transforms
4. Populate a new `sceneStore` (scene objects, relations, attributes, tags)
5. Scene mounts; `FileInstances` + future scene object renderers read from `sceneStore`
6. Physics bodies spawn:
   - `is_sleeping = 1` → spawn as `Fixed` at exact saved transform, immediately switch to
     `Dynamic` — no drop offset, lands in place
   - `is_sleeping = 0` → spawn as `Dynamic` with saved linear/angular velocities applied
   - `is_pinned = 1` → remain `Fixed` permanently

### Save triggers

- **Physics-quiet detection** — after all body velocities fall below threshold for ~1 s,
  collect changed transforms and call `workspace:saveScene`
- **`beforeunload`** — final synchronous flush of any dirty state

### In-memory LOD snapshot (Fix #1)

A `Map<string, {x,y,z,rx,ry,rz,rw}>` ref inside `FileInstances` captures each body's
exact translation and rotation just before LOD-disabling it. On re-enable, the body is
restored to the snapshot position with zeroed velocities — no `+ 2` offset.

---

## Part 6 — Future Extensions

The schema is designed to be additive:

| Future feature | How it fits |
|---|---|
| Sticky note objects | New `object_type = 'annotation'`, row in `geometry_objects` |
| Boundary / grouping boxes | New `object_type = 'box'`, spatial relations `contained_by` |
| Directory platform persistence | `object_type = 'directory'`, row in `entity_links` |
| Agent-created paths | `object_type = 'path'`, geometry_data `{points:[...]}` |
| Per-file AI summary | `attributes` row with `key = 'ai_summary'`, `value_type = 'text'` |
| Semantic file search | Query `file_embeddings` with `vector_distance_cos` |
| Shared scene export | Dump `scene_objects` + relations as JSON; re-import into new workspace |
