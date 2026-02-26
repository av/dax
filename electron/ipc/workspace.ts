import { ipcMain } from 'electron';
import path from 'path';
import { databaseService } from '../services/database';
import type {
  SceneObjectRow,
  EntityLinkRow,
  GeometryObjectRow,
  AttributeRow,
  SceneObjectTagRow,
  SpatialRelationSnapshot,
  SceneObjectSnapshot,
  SceneSnapshot,
  SaveSceneObject,
  TaggedObject,
  TagRow,
} from '../../src/types/index';

// ── Helpers ─────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Handlers ────────────────────────────────────────────

export function registerWorkspaceHandlers(): void {

  // ── workspace:open ──────────────────────────────────
  ipcMain.handle('workspace:open', async (_event, { path: wsPath, name }: { path: string; name: string }) => {
    try {
      const db = databaseService.db;
      await db.prepare(
        `INSERT INTO workspaces (path, name, last_opened_at) VALUES (?, ?, unixepoch())
         ON CONFLICT(path) DO UPDATE SET last_opened_at=excluded.last_opened_at`,
      ).run(wsPath, name);
      const row = await db.prepare('SELECT id FROM workspaces WHERE path = ?').get(wsPath) as { id: number };
      return { workspaceId: row.id };
    } catch (err) {
      throw new Error(`workspace:open failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── workspace:loadScene ─────────────────────────────
  ipcMain.handle('workspace:loadScene', async (_event, { workspaceId }: { workspaceId: number }) => {
    try {
      const db = databaseService.db;

      type RawRow = SceneObjectRow & {
        entity_type: string | null;
        entity_id: number | null;
        geometry_type: string | null;
        geometry_data: string | null;
      };

      const soRows = await db.prepare(
        `SELECT so.*,
                el.entity_type, el.entity_id,
                go.geometry_type, go.geometry_data
         FROM scene_objects so
         LEFT JOIN entity_links el ON el.scene_object_id = so.id
         LEFT JOIN geometry_objects go ON go.scene_object_id = so.id
         WHERE so.workspace_id = ?`,
      ).all(workspaceId) as RawRow[];

      const objects: SceneObjectSnapshot[] = await Promise.all(
        soRows.map(async (row): Promise<SceneObjectSnapshot> => {
          const sceneObject: SceneObjectRow = {
            id: row.id,
            workspace_id: row.workspace_id,
            object_type: row.object_type,
            label: row.label,
            visible: row.visible,
            opacity: row.opacity,
            color_override: row.color_override,
            pos_x: row.pos_x, pos_y: row.pos_y, pos_z: row.pos_z,
            rot_x: row.rot_x, rot_y: row.rot_y, rot_z: row.rot_z, rot_w: row.rot_w,
            scale_x: row.scale_x, scale_y: row.scale_y, scale_z: row.scale_z,
            lin_vel_x: row.lin_vel_x, lin_vel_y: row.lin_vel_y, lin_vel_z: row.lin_vel_z,
            ang_vel_x: row.ang_vel_x, ang_vel_y: row.ang_vel_y, ang_vel_z: row.ang_vel_z,
            is_sleeping: row.is_sleeping,
            is_pinned: row.is_pinned,
            mass: row.mass,
            restitution: row.restitution,
            friction: row.friction,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };

          const entityLink: EntityLinkRow | null =
            row.entity_type != null && row.entity_id != null
              ? { scene_object_id: row.id, entity_type: row.entity_type, entity_id: row.entity_id }
              : null;

          const geometryObject: GeometryObjectRow | null =
            row.geometry_type != null && row.geometry_data != null
              ? { scene_object_id: row.id, geometry_type: row.geometry_type, geometry_data: row.geometry_data }
              : null;

          let filePath: string | null = null;
          let dirPath: string | null = null;
          if (entityLink) {
            if (entityLink.entity_type === 'file') {
              const fr = await db.prepare('SELECT path FROM files WHERE id = ?').get(entityLink.entity_id) as { path: string } | undefined;
              filePath = fr?.path ?? null;
            } else if (entityLink.entity_type === 'directory') {
              const dr = await db.prepare('SELECT path FROM directories WHERE id = ?').get(entityLink.entity_id) as { path: string } | undefined;
              dirPath = dr?.path ?? null;
            }
          }

          const attributes = await db.prepare(
            'SELECT * FROM attributes WHERE scene_object_id = ?',
          ).all(row.id) as AttributeRow[];

          const tags = await db.prepare(
            `SELECT sot.scene_object_id, t.id AS tag_id, t.name AS tag_name, t.color AS tag_color
             FROM scene_object_tags sot
             JOIN tags t ON t.id = sot.tag_id
             WHERE sot.scene_object_id = ?`,
          ).all(row.id) as SceneObjectTagRow[];

          return { sceneObject, entityLink, geometryObject, filePath, dirPath, attributes, tags };
        }),
      );

      const relations = await db.prepare(
        `SELECT id, source_object_id, target_object_id, relation_type,
                offset_x, offset_y, offset_z,
                offset_rot_x, offset_rot_y, offset_rot_z, offset_rot_w
         FROM spatial_relations WHERE workspace_id = ?`,
      ).all(workspaceId) as SpatialRelationSnapshot[];

      const snapshot: SceneSnapshot = { workspaceId, objects, relations };
      return snapshot;
    } catch (err) {
      throw new Error(`workspace:loadScene failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── workspace:saveScene ─────────────────────────────
  ipcMain.handle('workspace:saveScene', async (_event, { workspaceId, objects }: { workspaceId: number; objects: SaveSceneObject[] }) => {
    try {
      const db = databaseService.db;

      for (const obj of objects) {
        const baseName = path.basename(obj.filePath);
        const extension = obj.objectType === 'file' ? (path.extname(baseName) || null) : null;
        const entityType = obj.objectType === 'file' ? 'file' : 'directory';

        // 1. Upsert into files or directories
        if (obj.objectType === 'file') {
          await db.prepare(
            `INSERT INTO files (path, name, extension) VALUES (?, ?, ?)
             ON CONFLICT(path) DO UPDATE SET updated_at=unixepoch()`,
          ).run(obj.filePath, baseName, extension);
        } else {
          await db.prepare(
            `INSERT INTO directories (path, name) VALUES (?, ?)
             ON CONFLICT(path) DO UPDATE SET updated_at=unixepoch()`,
          ).run(obj.filePath, baseName);
        }

        // 2. Get the entity id
        const entityTable = obj.objectType === 'file' ? 'files' : 'directories';
        const entityRow = await db.prepare(
          `SELECT id FROM ${entityTable} WHERE path = ?`,
        ).get(obj.filePath) as { id: number };
        const entityId = entityRow.id;

        // 3. Check for existing scene_object
        const existing = await db.prepare(
          `SELECT so.id FROM scene_objects so
           JOIN entity_links el ON el.scene_object_id = so.id
           WHERE so.workspace_id = ? AND el.entity_type = ? AND el.entity_id = ?`,
        ).get(workspaceId, entityType, entityId) as { id: number } | undefined;

        if (existing) {
          // 3a. Update existing
          await db.prepare(
            `UPDATE scene_objects SET
               pos_x=?, pos_y=?, pos_z=?,
               rot_x=?, rot_y=?, rot_z=?, rot_w=?,
               scale_x=?, scale_y=?, scale_z=?,
               lin_vel_x=?, lin_vel_y=?, lin_vel_z=?,
               ang_vel_x=?, ang_vel_y=?, ang_vel_z=?,
               is_sleeping=1, updated_at=unixepoch()
             WHERE id=?`,
          ).run(
            obj.pos_x, obj.pos_y, obj.pos_z,
            obj.rot_x, obj.rot_y, obj.rot_z, obj.rot_w,
            obj.scale_x, obj.scale_y, obj.scale_z,
            obj.lin_vel_x, obj.lin_vel_y, obj.lin_vel_z,
            obj.ang_vel_x, obj.ang_vel_y, obj.ang_vel_z,
            existing.id,
          );
        } else {
          // 3b. Insert scene_object
          await db.prepare(
            `INSERT INTO scene_objects
               (workspace_id, object_type,
                pos_x, pos_y, pos_z,
                rot_x, rot_y, rot_z, rot_w,
                scale_x, scale_y, scale_z,
                lin_vel_x, lin_vel_y, lin_vel_z,
                ang_vel_x, ang_vel_y, ang_vel_z,
                is_sleeping, is_pinned)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0)`,
          ).run(
            workspaceId, obj.objectType,
            obj.pos_x, obj.pos_y, obj.pos_z,
            obj.rot_x, obj.rot_y, obj.rot_z, obj.rot_w,
            obj.scale_x, obj.scale_y, obj.scale_z,
            obj.lin_vel_x, obj.lin_vel_y, obj.lin_vel_z,
            obj.ang_vel_x, obj.ang_vel_y, obj.ang_vel_z,
          );

          // Retrieve the new scene_object id via last_insert_rowid()
          const lastRow = await db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number };
          const sceneObjectId = lastRow.id;

          // Insert entity_link
          await db.prepare(
            `INSERT INTO entity_links (scene_object_id, entity_type, entity_id) VALUES (?,?,?)`,
          ).run(sceneObjectId, entityType, entityId);
        }
      }
    } catch (err) {
      throw new Error(`workspace:saveScene failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── workspace:upsertAttributes ──────────────────────
  ipcMain.handle('workspace:upsertAttributes', async (_event, { sceneObjectId, attrs }: { sceneObjectId: number; attrs: Record<string, string> }) => {
    try {
      const db = databaseService.db;
      for (const [key, value] of Object.entries(attrs)) {
        await db.prepare(
          `INSERT OR REPLACE INTO attributes (scene_object_id, key, value, value_type, updated_at)
           VALUES (?,?,?,'text',unixepoch())`,
        ).run(sceneObjectId, key, value);
      }
    } catch (err) {
      throw new Error(`workspace:upsertAttributes failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── workspace:loadAttributes ────────────────────────
  ipcMain.handle('workspace:loadAttributes', async (_event, { sceneObjectId }: { sceneObjectId: number }) => {
    try {
      const db = databaseService.db;
      const rows = await db.prepare('SELECT * FROM attributes WHERE scene_object_id = ?').all(sceneObjectId) as AttributeRow[];
      return rows;
    } catch (err) {
      throw new Error(`workspace:loadAttributes failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── workspace:saveTags ──────────────────────────────
  ipcMain.handle('workspace:saveTags', async (_event, { sceneObjectId, tagIds }: { sceneObjectId: number; tagIds: number[] }) => {
    try {
      const db = databaseService.db;
      await db.prepare('DELETE FROM scene_object_tags WHERE scene_object_id = ?').run(sceneObjectId);
      for (const tagId of tagIds) {
        await db.prepare(
          'INSERT INTO scene_object_tags (scene_object_id, tag_id) VALUES (?,?)',
        ).run(sceneObjectId, tagId);
      }
    } catch (err) {
      throw new Error(`workspace:saveTags failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── workspace:loadTags ──────────────────────────────
  ipcMain.handle('workspace:loadTags', async (_event, { workspaceId }: { workspaceId: number }) => {
    try {
      const db = databaseService.db;

      type TagLinkRow = { scene_object_id: number; tag_id: number; name: string; color: string | null };

      const rows = await db.prepare(
        `SELECT sot.scene_object_id, t.id AS tag_id, t.name, t.color
         FROM scene_object_tags sot
         JOIN tags t ON t.id = sot.tag_id
         JOIN scene_objects so ON so.id = sot.scene_object_id
         WHERE so.workspace_id = ?`,
      ).all(workspaceId) as TagLinkRow[];

      const map = new Map<number, TagRow[]>();
      for (const row of rows) {
        const list = map.get(row.scene_object_id) ?? [];
        list.push({ id: row.tag_id, name: row.name, color: row.color });
        map.set(row.scene_object_id, list);
      }

      const result: TaggedObject[] = [];
      for (const [scene_object_id, tags] of map) {
        result.push({ scene_object_id, tags });
      }
      return result;
    } catch (err) {
      throw new Error(`workspace:loadTags failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── workspace:saveEmbedding ─────────────────────────
  ipcMain.handle('workspace:saveEmbedding', async (_event, { fileId, model, vector }: { fileId: number; model: string; vector: number[] }) => {
    try {
      const db = databaseService.db;
      const json = JSON.stringify(vector);
      await db.prepare(
        `INSERT OR REPLACE INTO file_embeddings (file_id, model, embedding, embedded_at) VALUES (?,?,?,unixepoch())`,
      ).run(fileId, model, json);
    } catch (err) {
      throw new Error(`workspace:saveEmbedding failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ── workspace:searchByEmbedding ─────────────────────
  ipcMain.handle('workspace:searchByEmbedding', async (_event, { vector, limit = 10 }: { vector: number[]; limit?: number }) => {
    try {
      const db = databaseService.db;

      type EmbeddingRow = { file_id: number; embedding: string };
      const rows = await db.prepare('SELECT file_id, embedding FROM file_embeddings').all() as EmbeddingRow[];

      const scored = rows.map((row) => {
        let parsed: number[];
        try {
          parsed = JSON.parse(row.embedding) as number[];
        } catch {
          return null;
        }
        const similarity = cosineSimilarity(vector, parsed);
        // Convert similarity to distance (0 = identical, 2 = opposite)
        return { fileId: row.file_id, distance: 1 - similarity };
      }).filter((r): r is { fileId: number; distance: number } => r !== null);

      scored.sort((a, b) => a.distance - b.distance);
      return scored.slice(0, limit);
    } catch (err) {
      throw new Error(`workspace:searchByEmbedding failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}
