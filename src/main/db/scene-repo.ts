/**
 * Repository for the scene_objects table.
 * CRUD operations for 3D scene object positions and metadata.
 */
import type { TursoDB } from './index';
import type { SceneObjectRow } from '../../renderer/db/types';

interface SceneObjectDbRow {
  id: string;
  path: string;
  parent_path: string | null;
  type: string;
  position_x: number;
  position_y: number;
  position_z: number;
  is_pinned: number;
  created_at: number;
  updated_at: number;
}

function toRow(r: SceneObjectDbRow): SceneObjectRow {
  return {
    id: r.id,
    path: r.path,
    parentPath: r.parent_path,
    type: r.type as 'file' | 'folder',
    positionX: r.position_x,
    positionY: r.position_y,
    positionZ: r.position_z,
    isPinned: r.is_pinned === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SceneRepo {
  constructor(private db: TursoDB) {}

  /** Get all scene objects. */
  async getAll(): Promise<SceneObjectRow[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM scene_objects')
      .all()) as SceneObjectDbRow[];
    return rows.map(toRow);
  }

  /** Get a scene object by path. */
  async getByPath(path: string): Promise<SceneObjectRow | null> {
    const row = (await this.db
      .prepare('SELECT * FROM scene_objects WHERE path = ?')
      .get(path)) as SceneObjectDbRow | undefined;
    return row ? toRow(row) : null;
  }

  /** Get children of a parent path. */
  async getChildren(parentPath: string): Promise<SceneObjectRow[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM scene_objects WHERE parent_path = ?')
      .all(parentPath)) as SceneObjectDbRow[];
    return rows.map(toRow);
  }

  /** Insert or update a scene object. */
  async upsert(obj: SceneObjectRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO scene_objects
         (id, path, parent_path, type, position_x, position_y, position_z, is_pinned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        obj.id,
        obj.path,
        obj.parentPath,
        obj.type,
        obj.positionX,
        obj.positionY,
        obj.positionZ,
        obj.isPinned ? 1 : 0,
        obj.createdAt,
        obj.updatedAt,
      );
  }

  /** Batch insert or update scene objects. Uses a transaction for atomicity. */
  async upsertBatch(objs: SceneObjectRow[]): Promise<void> {
    if (objs.length === 0) return;

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO scene_objects
       (id, path, parent_path, type, position_x, position_y, position_z, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    await this.db.prepare('BEGIN TRANSACTION').run();
    try {
      for (const obj of objs) {
        await stmt.run(
          obj.id,
          obj.path,
          obj.parentPath,
          obj.type,
          obj.positionX,
          obj.positionY,
          obj.positionZ,
          obj.isPinned ? 1 : 0,
          obj.createdAt,
          obj.updatedAt,
        );
      }
      await this.db.prepare('COMMIT').run();
    } catch (err) {
      await this.db.prepare('ROLLBACK').run();
      throw err;
    }
  }

  /** Delete a scene object by path. */
  async deleteByPath(path: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM scene_objects WHERE path = ?')
      .run(path);
  }

  /**
   * Delete scene objects whose paths are not in the given valid paths list.
   * Returns the number of deleted orphans.
   */
  async deleteOrphans(validPaths: string[]): Promise<number> {
    if (validPaths.length === 0) {
      const countRow = (await this.db
        .prepare('SELECT COUNT(*) as cnt FROM scene_objects')
        .get()) as { cnt: number };
      await this.db.prepare('DELETE FROM scene_objects').run();
      return countRow.cnt;
    }

    // Build placeholders for IN clause
    const placeholders = validPaths.map(() => '?').join(', ');
    const countRow = (await this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM scene_objects WHERE path NOT IN (${placeholders})`,
      )
      .get(...validPaths)) as { cnt: number };

    await this.db
      .prepare(
        `DELETE FROM scene_objects WHERE path NOT IN (${placeholders})`,
      )
      .run(...validPaths);

    return countRow.cnt;
  }

  /** Update position of a scene object. */
  async updatePosition(
    path: string,
    positionX: number,
    positionY: number,
    positionZ: number,
    isPinned: boolean,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE scene_objects
         SET position_x = ?, position_y = ?, position_z = ?, is_pinned = ?, updated_at = ?
         WHERE path = ?`,
      )
      .run(positionX, positionY, positionZ, isPinned ? 1 : 0, Date.now(), path);
  }
}
