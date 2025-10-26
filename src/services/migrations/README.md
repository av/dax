# Database Migrations

This directory contains SQL migration files for the DAX database schema.

## Migration System

The migration system tracks which migrations have been applied using a `schema_migrations` table. Migrations are run automatically when the database is initialized.

## File Naming Convention

Migration files follow this naming pattern:
```
NNN_description.sql
```

Where:
- `NNN` is a zero-padded 3-digit version number (e.g., `001`, `002`, `003`)
- `description` is a brief snake_case description of what the migration does

## Current Migrations

- `000_init.sql` - Creates the migration tracking table
- `001_initial_schema.sql` - Initial database schema with all tables

## Adding a New Migration

1. **Create a new migration file** in this directory with the next sequential number:
   ```
   src/services/migrations/002_add_feature.sql
   ```

2. **Write your SQL** in the migration file:
   ```sql
   -- Add a new column to canvas_nodes
   ALTER TABLE canvas_nodes ADD COLUMN tags TEXT;
   
   -- Create an index
   CREATE INDEX IF NOT EXISTS idx_canvas_nodes_tags ON canvas_nodes(tags);
   ```

3. **Register the migration** in `migrationRunner.ts`:
   ```typescript
   import migration002 from './migrations/002_add_feature.sql?raw';
   
   const migrations: Migration[] = [
     // ... existing migrations
     {
       version: 2,
       description: 'Add tags to canvas nodes',
       sql: migration002,
     },
   ];
   ```

4. **Test the migration**:
   - The migration will run automatically on next app start
   - Check the console for migration logs
   - Verify the schema changes in your database

## Best Practices

### DO:
- ✅ Always use `IF NOT EXISTS` for CREATE statements
- ✅ Make migrations idempotent (safe to run multiple times)
- ✅ Use transactions for multi-step migrations
- ✅ Include comments explaining complex changes
- ✅ Test migrations on a copy of production data first

### DON'T:
- ❌ Never modify existing migration files after they've been applied
- ❌ Don't delete old migration files
- ❌ Avoid breaking changes without a data migration path
- ❌ Don't use database-specific features (keep it SQLite compatible)

## Migration Examples

### Adding a Table
```sql
-- Create a new table for tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
```

### Adding a Column
```sql
-- Add description column to canvas_nodes
ALTER TABLE canvas_nodes ADD COLUMN description TEXT;
```

### Creating an Index
```sql
-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_title ON canvas_nodes(title);
```

### Data Migration
```sql
-- Migrate data from old format to new format
UPDATE preferences 
SET hotkeys = json_replace(hotkeys, '$.newNode', 'Ctrl+N')
WHERE json_extract(hotkeys, '$.newNode') IS NULL;
```

## Checking Migration Status

The migration runner automatically tracks which migrations have been applied. You can query the status:

```sql
SELECT * FROM schema_migrations ORDER BY version;
```

This will show:
- `version` - Migration number
- `description` - What the migration does
- `applied_at` - When it was applied

## Rollback Strategy

Since SQLite doesn't support `DROP COLUMN`, rollbacks must be handled carefully:

1. **For new tables**: Create a migration that drops the table
2. **For new columns**: Leave them (they're harmless if not used)
3. **For data changes**: Create a reverse migration with opposite changes

## Migration Runner

The `MigrationRunner` class handles:
- Tracking applied migrations
- Running pending migrations in order
- Logging migration progress
- Handling errors gracefully

Migrations are run during database initialization in `database.ts`.
