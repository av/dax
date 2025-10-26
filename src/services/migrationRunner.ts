import { Client } from '@libsql/client';
import migration000 from './migrations/000_init.sql?raw';
import migration001 from './migrations/001_initial_schema.sql?raw';

interface Migration {
  version: number;
  description: string;
  sql: string;
}

// All migrations in order
const migrations: Migration[] = [
  {
    version: 0,
    description: 'Initialize migration tracking',
    sql: migration000,
  },
  {
    version: 1,
    description: 'Initial schema with all tables',
    sql: migration001,
  },
];

export class MigrationRunner {
  constructor(private client: Client) {}

  async runMigrations(): Promise<void> {
    // First, ensure the migrations table exists
    await this.client.execute(migrations[0].sql);

    // Get current schema version
    const currentVersion = await this.getCurrentVersion();

    // Run pending migrations
    for (const migration of migrations) {
      if (migration.version <= currentVersion) {
        continue; // Already applied
      }

      console.log(`Applying migration ${migration.version}: ${migration.description}`);
      
      // Execute migration
      const statements = migration.sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await this.client.execute(statement);
        }
      }

      // Record migration
      await this.client.execute({
        sql: 'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
        args: [migration.version, migration.description],
      });

      console.log(`Migration ${migration.version} applied successfully`);
    }
  }

  private async getCurrentVersion(): Promise<number> {
    try {
      const result = await this.client.execute(
        'SELECT MAX(version) as version FROM schema_migrations'
      );
      
      const version = result.rows[0]?.version;
      return typeof version === 'number' ? version : -1;
    } catch (error) {
      // Table doesn't exist yet
      return -1;
    }
  }

  async getMigrationHistory(): Promise<Array<{ version: number; description: string; appliedAt: string }>> {
    try {
      const result = await this.client.execute(
        'SELECT version, description, applied_at FROM schema_migrations ORDER BY version'
      );
      
      return result.rows.map(row => ({
        version: row.version as number,
        description: row.description as string,
        appliedAt: row.applied_at as string,
      }));
    } catch (error) {
      return [];
    }
  }
}
