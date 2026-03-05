/**
 * Repository for the app_config table.
 * Provides get/set/delete for key-value configuration pairs.
 */
import type { TursoDB } from './index';
import type { AppConfigRow } from '../../renderer/db/types';

export class ConfigRepo {
  constructor(private db: TursoDB) {}

  /** Get a config value by key. Returns null if not found. */
  async get(key: string): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT value FROM app_config WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  /** Set a config value. Uses INSERT OR REPLACE (upsert). */
  async set(key: string, value: string): Promise<void> {
    await this.db
      .prepare(
        'INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, ?)',
      )
      .run(key, value, Date.now());
  }

  /** Delete a config entry. Returns true if a row was deleted. */
  async delete(key: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM app_config WHERE key = ?')
      .run(key);
    return (result as { changes?: number })?.changes !== 0;
  }

  /** Get all config entries. */
  async getAll(): Promise<AppConfigRow[]> {
    const rows = await this.db
      .prepare('SELECT key, value, updated_at as updatedAt FROM app_config')
      .all() as Array<{ key: string; value: string; updatedAt: number }>;
    return rows.map((r) => ({
      key: r.key,
      value: r.value,
      updatedAt: r.updatedAt,
    }));
  }
}
