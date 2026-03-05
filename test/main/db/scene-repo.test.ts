import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB } from '../../helpers/db';
import { SceneRepo } from '../../../src/main/db/scene-repo';
import type { TursoDB } from '../../../src/main/db/index';
import type { SceneObjectRow } from '../../../src/renderer/db/types';

function makeSceneObj(overrides: Partial<SceneObjectRow> = {}): SceneObjectRow {
  const now = Date.now();
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    path: `src/file-${Math.random().toString(36).slice(2)}.ts`,
    parentPath: null,
    type: 'file',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    isPinned: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SceneRepo', () => {
  let db: TursoDB;
  let repo: SceneRepo;

  beforeEach(async () => {
    db = await createTestDB();
    repo = new SceneRepo(db);
  });

  describe('upsert / getAll', () => {
    it('returns empty array for fresh DB', async () => {
      const all = await repo.getAll();
      expect(all).toEqual([]);
    });

    it('inserts and retrieves a scene object', async () => {
      const obj = makeSceneObj({ path: 'src/index.ts', type: 'file' });
      await repo.upsert(obj);

      const all = await repo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].path).toBe('src/index.ts');
      expect(all[0].type).toBe('file');
      expect(all[0].isPinned).toBe(false);
    });

    it('updates existing object on upsert (same path)', async () => {
      const obj = makeSceneObj({ path: 'src/index.ts', positionX: 0 });
      await repo.upsert(obj);

      await repo.upsert({ ...obj, positionX: 42, updatedAt: Date.now() });

      const all = await repo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].positionX).toBe(42);
    });
  });

  describe('getByPath', () => {
    it('returns null for missing path', async () => {
      const result = await repo.getByPath('nonexistent');
      expect(result).toBeNull();
    });

    it('returns matching object', async () => {
      const obj = makeSceneObj({ path: 'README.md', type: 'file' });
      await repo.upsert(obj);

      const result = await repo.getByPath('README.md');
      expect(result).not.toBeNull();
      expect(result!.path).toBe('README.md');
    });
  });

  describe('getChildren', () => {
    it('returns children of a parent', async () => {
      await repo.upsert(makeSceneObj({ path: 'src', type: 'folder' }));
      await repo.upsert(
        makeSceneObj({ path: 'src/a.ts', parentPath: 'src', type: 'file' }),
      );
      await repo.upsert(
        makeSceneObj({ path: 'src/b.ts', parentPath: 'src', type: 'file' }),
      );
      await repo.upsert(
        makeSceneObj({ path: 'README.md', type: 'file' }),
      );

      const children = await repo.getChildren('src');
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.path).sort()).toEqual(['src/a.ts', 'src/b.ts']);
    });
  });

  describe('deleteByPath', () => {
    it('deletes an object by path', async () => {
      const obj = makeSceneObj({ path: 'temp.txt' });
      await repo.upsert(obj);

      await repo.deleteByPath('temp.txt');
      const result = await repo.getByPath('temp.txt');
      expect(result).toBeNull();
    });
  });

  describe('upsertBatch', () => {
    it('inserts multiple objects atomically', async () => {
      const objs = [
        makeSceneObj({ path: 'a.ts' }),
        makeSceneObj({ path: 'b.ts' }),
        makeSceneObj({ path: 'c.ts' }),
      ];

      await repo.upsertBatch(objs);
      const all = await repo.getAll();
      expect(all).toHaveLength(3);
    });

    it('handles empty batch', async () => {
      await repo.upsertBatch([]);
      const all = await repo.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('deleteOrphans', () => {
    it('deletes objects not in the valid paths list', async () => {
      await repo.upsert(makeSceneObj({ path: 'keep.ts' }));
      await repo.upsert(makeSceneObj({ path: 'remove.ts' }));
      await repo.upsert(makeSceneObj({ path: 'also-remove.ts' }));

      const deleted = await repo.deleteOrphans(['keep.ts']);
      expect(deleted).toBe(2);

      const all = await repo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].path).toBe('keep.ts');
    });

    it('deletes all when valid paths empty', async () => {
      await repo.upsert(makeSceneObj({ path: 'a.ts' }));
      await repo.upsert(makeSceneObj({ path: 'b.ts' }));

      const deleted = await repo.deleteOrphans([]);
      expect(deleted).toBe(2);

      const all = await repo.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('updatePosition', () => {
    it('updates position and pin state', async () => {
      const obj = makeSceneObj({ path: 'moved.ts', positionX: 0, positionY: 0, positionZ: 0 });
      await repo.upsert(obj);

      await repo.updatePosition('moved.ts', 10, 5, 20, true);

      const result = await repo.getByPath('moved.ts');
      expect(result!.positionX).toBe(10);
      expect(result!.positionY).toBe(5);
      expect(result!.positionZ).toBe(20);
      expect(result!.isPinned).toBe(true);
    });
  });
});
