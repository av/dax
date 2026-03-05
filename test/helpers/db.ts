/**
 * Test DB helper: create in-memory Turso instances for testing.
 */
import { connect } from '@tursodatabase/database';
import { runMigrations } from '../../src/main/db/migrations';
import type { TursoDB } from '../../src/main/db/index';

/**
 * Create a fresh in-memory Turso database with all tables migrated.
 * Each call returns a completely isolated database.
 */
export async function createTestDB(): Promise<TursoDB> {
  const db = await connect(':memory:');
  await runMigrations(db);
  return db;
}
