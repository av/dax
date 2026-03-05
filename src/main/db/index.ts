/**
 * Database connection factory.
 * Opens a Turso (libSQL) database and runs migrations on startup.
 *
 * Uses @tursodatabase/database for the underlying connection.
 */
import { connect } from '@tursodatabase/database';
import { runMigrations } from './migrations';

export type TursoDB = Awaited<ReturnType<typeof connect>>;

let _db: TursoDB | null = null;

/**
 * Initialize the database connection.
 * Opens the Turso DB file and runs pending migrations.
 *
 * @param dbPath - Path to the database file, or ':memory:' for in-memory DB
 * @returns The connected database instance
 */
export async function initDatabase(dbPath: string): Promise<TursoDB> {
  if (_db) return _db;

  const db = await connect(dbPath);
  // Enable WAL mode for better concurrent read performance
  await db.pragma('journal_mode = WAL', {});
  // Run migrations
  await runMigrations(db);

  _db = db;
  return db;
}

/**
 * Get the current database connection.
 * Throws if initDatabase hasn't been called.
 */
export function getDatabase(): TursoDB {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _db;
}

/**
 * Close the database connection.
 */
export async function closeDatabase(): Promise<void> {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Create an in-memory database for testing.
 * Runs migrations automatically.
 */
export async function createTestDatabase(): Promise<TursoDB> {
  const db = await connect(':memory:');
  await runMigrations(db);
  return db;
}
