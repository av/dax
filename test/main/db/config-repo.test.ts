import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB } from '../../helpers/db';
import { ConfigRepo } from '../../../src/main/db/config-repo';
import type { TursoDB } from '../../../src/main/db/index';

describe('ConfigRepo', () => {
  let db: TursoDB;
  let repo: ConfigRepo;

  beforeEach(async () => {
    db = await createTestDB();
    repo = new ConfigRepo(db);
  });

  describe('get/set', () => {
    it('returns null for missing key', async () => {
      const result = await repo.get('nonexistent');
      expect(result).toBeNull();
    });

    it('stores and retrieves a value', async () => {
      await repo.set('workspace_path', '/home/user/project');
      const result = await repo.get('workspace_path');
      expect(result).toBe('/home/user/project');
    });

    it('overwrites existing value', async () => {
      await repo.set('workspace_path', '/old/path');
      await repo.set('workspace_path', '/new/path');
      const result = await repo.get('workspace_path');
      expect(result).toBe('/new/path');
    });

    it('stores JSON values', async () => {
      const config = { theme: 'dark', zoom: 1.5 };
      await repo.set('settings', JSON.stringify(config));
      const result = await repo.get('settings');
      expect(JSON.parse(result!)).toEqual(config);
    });
  });

  describe('delete', () => {
    it('returns false for missing key', async () => {
      const result = await repo.delete('nonexistent');
      expect(result).toBe(false);
    });

    it('deletes existing key and returns true', async () => {
      await repo.set('temp_key', 'value');
      const deleted = await repo.delete('temp_key');
      expect(deleted).toBe(true);

      const result = await repo.get('temp_key');
      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns empty array for fresh DB', async () => {
      // Note: migration inserts schema_version, so filter it out
      const all = await repo.getAll();
      const nonSchema = all.filter((r) => r.key !== 'schema_version');
      expect(nonSchema).toEqual([]);
    });

    it('returns all config entries', async () => {
      await repo.set('key1', 'val1');
      await repo.set('key2', 'val2');
      const all = await repo.getAll();
      const keys = all.map((r) => r.key);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });
});
