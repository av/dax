# Database Quick Reference Guide

## Quick Start

### Running Database Tests

```bash
# Run all tests including database verification
npm test

# Run only database tests
npm run test:database-features
```

### Database Configuration

**Local Development:**
```bash
# .env file
TURSO_URL=file:dax.db
```

**Production (Turso Cloud):**
```bash
# .env file
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

---

## Common Operations

### Initialize Database

```typescript
import { initializeDatabase } from '@/services/database';

// Electron (automatic in main process)
await initializeDatabase();

// Web/Cloud
await initializeDatabase({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
```

### Get Database Instance

```typescript
import { getDatabaseInstance } from '@/services/database';

const db = getDatabaseInstance();
```

---

## User Management

### Create User

```typescript
await db.addUser({
  id: 'user123',
  username: 'john',
  email: 'john@example.com',
  role: 'user', // 'admin' | 'user' | 'viewer'
  permissions: ['read', 'write']
});
```

### Get User

```typescript
const user = await db.getUser('user123');
```

---

## Canvas Nodes

### Save Canvas Node

```typescript
await db.saveCanvasNode({
  id: 'node123',
  type: 'data', // 'data' | 'agent' | 'transform' | 'output'
  title: 'My Data Source',
  x: 100,
  y: 200,
  width: 200,
  height: 150,
  data: { source: 'file.csv' },
  config: { autoRefresh: true }
}, userId);
```

### Get Canvas Nodes

```typescript
const nodes = await db.getCanvasNodes(userId);
```

### Delete Canvas Node

```typescript
await db.deleteCanvasNode('node123', userId);
```

---

## RDF Entities

### Save RDF Entity

```typescript
await db.saveRDFEntity({
  id: 'person123',
  type: 'Person',
  attributes: {
    name: 'John Doe',
    age: 30,
    email: 'john@example.com'
  },
  links: []
}, userId);
```

### Get RDF Entities

```typescript
// Get all entities
const entities = await db.getRDFEntities(userId);

// Get entities by type
const people = await db.getRDFEntities(userId, 'Person');
```

### Query RDF Entities

```typescript
// Query by attribute
const activeUsers = await db.queryRDFEntitiesByAttribute(
  userId, 
  'status', 
  'active'
);

// Search entities
const results = await db.searchRDFEntities(userId, 'john');
```

### Save RDF Link

```typescript
await db.saveRDFLink({
  from: 'person123',
  to: 'company456',
  type: 'works_at',
  properties: { since: '2020-01-01' }
}, userId);
```

### Delete RDF Entity

```typescript
await db.deleteRDFEntity('person123', userId);
```

---

## Preferences

### Save Preferences

```typescript
await db.savePreferences(userId, {
  theme: 'dark',
  autostart: true,
  dataDir: '/path/to/data',
  backup: {
    enabled: true,
    interval: 3600,
    location: '/path/to/backups'
  },
  sync: {
    enabled: false,
    provider: undefined,
    config: {}
  },
  language: 'en',
  hotkeys: {
    save: 'Ctrl+S',
    open: 'Ctrl+O'
  }
});
```

### Get Preferences

```typescript
const prefs = await db.getPreferences(userId);
```

---

## Agent Configurations

### Save Agent Config

```typescript
await db.saveAgentConfig({
  id: 'agent123',
  name: 'GPT-4',
  icon: 'Bot',
  iconType: 'lucide',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: 'sk-...',
  headers: { 'Content-Type': 'application/json' },
  queryParams: {},
  extraBody: {},
  preset: 'openai',
  temperature: 0.7,
  maxTokens: 2000,
  tools: [],
  systemPrompt: 'You are a helpful assistant.'
}, userId);
```

### Get Agent Configs

```typescript
const agents = await db.getAgentConfigs(userId);
```

### Delete Agent Config

```typescript
await db.deleteAgentConfig('agent123', userId);
```

---

## Document Storage

### Store Document

```typescript
await db.store('doc123', {
  title: 'My Document',
  content: 'Document content...',
  metadata: { author: 'John' }
}, userId);
```

### Get Document

```typescript
const doc = await db.get('doc123', userId);
```

### Delete Document

```typescript
await db.delete('doc123', userId);
```

---

## Access Control (ACL)

### Set Permissions

```typescript
await db.setACL(
  'doc123',           // resource_id
  'document',         // resource_type
  'user456',          // user_id
  ['read', 'write']   // permissions
);
```

### Check Permission

```typescript
const canWrite = await db.checkPermission(
  'user456',     // user_id
  'doc123',      // resource_id
  'document',    // resource_type
  'write'        // permission
);
```

### Get ACL Entries

```typescript
const acl = await db.getACL('doc123', 'document');
```

### Permission Types

- `read` - View resource
- `write` - Modify resource
- `delete` - Delete resource
- `share` - Share with other users

---

## Search

### Semantic Search

```typescript
// Search across documents and canvas nodes
const results = await db.semanticSearch('machine learning', userId);
```

### RDF Search

```typescript
// Search RDF entities
const entities = await db.searchRDFEntities(userId, 'Person');
```

---

## Activity Logging

### Log Activity

```typescript
await db.logActivity(
  userId,
  'canvas_node_saved',
  'canvas_node',
  'node123',
  { title: 'My Node' }
);
```

### Get Activity Log

```typescript
// Get last 100 activities
const activities = await db.getActivityLog(userId, 100);
```

### Logged Actions

- `user_created`
- `canvas_node_saved`, `canvas_node_deleted`
- `rdf_entity_saved`, `rdf_entity_deleted`
- `rdf_link_created`, `rdf_link_deleted`
- `document_stored`, `document_deleted`
- `agent_config_saved`, `agent_config_deleted`
- `preferences_updated`
- `acl_updated`

---

## Statistics

### Get Database Stats

```typescript
const stats = await db.getStats();
// Returns:
// {
//   totalUsers: number,
//   totalCanvasNodes: number,
//   totalRDFEntities: number,
//   totalDocuments: number
// }
```

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles and permissions |
| `canvas_nodes` | Canvas node configurations |
| `rdf_entities` | RDF entities (knowledge graph nodes) |
| `rdf_links` | RDF relationships (knowledge graph edges) |
| `preferences` | User preferences and settings |
| `agent_configs` | AI agent configurations |
| `documents` | Generic document storage |
| `acl` | Access control list entries |
| `activity_log` | Audit trail of all operations |
| `schema_migrations` | Migration version tracking |

### Indexes

15 indexes for optimal query performance:
- `idx_canvas_nodes_user`, `idx_canvas_nodes_type`
- `idx_rdf_entities_user`, `idx_rdf_entities_type`
- `idx_rdf_links_user`, `idx_rdf_links_from`, `idx_rdf_links_to`
- `idx_acl_resource`, `idx_acl_user`
- `idx_documents_user`, `idx_documents_owner`
- `idx_agent_configs_user`
- `idx_activity_log_user`, `idx_activity_log_resource`

### FTS5 Virtual Tables

- `documents_fts` - Full-text search for documents
- `canvas_nodes_fts` - Full-text search for canvas nodes

---

## Migrations

### Creating a Migration

1. Create file in `src/services/migrations/` with format `NNN_description.sql`
2. Migrations run in numerical order (000, 001, 002, ...)
3. Must be idempotent (use `CREATE TABLE IF NOT EXISTS`, etc.)

### Example Migration

```sql
-- 003_add_new_table.sql

CREATE TABLE IF NOT EXISTS new_table (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_new_table_user 
  ON new_table(user_id);
```

### Running Migrations

Migrations run automatically on database initialization.

---

## Best Practices

### 1. Always Pass user_id

```typescript
// ✅ Good
await db.getCanvasNodes(userId);

// ❌ Bad
await db.getCanvasNodes(); // Missing userId
```

### 2. Check Permissions

```typescript
// For sensitive operations
const canDelete = await db.checkPermission(userId, resourceId, resourceType, 'delete');
if (!canDelete) {
  throw new Error('Permission denied');
}
await db.deleteCanvasNode(resourceId, userId);
```

### 3. Log Important Activities

```typescript
await db.saveCanvasNode(node, userId);
// Logging happens automatically in database service
```

### 4. Use Transactions for Batch Operations

```typescript
// For operations that should succeed or fail together
// Note: Transaction support coming in future update
```

### 5. Sanitize User Input

```typescript
import { sanitizers } from '@/lib/validation';

const safeHtml = sanitizers.escapeHtml(userInput);
const safePath = sanitizers.sanitizePath(filePath);
```

---

## Error Handling

### Common Errors

```typescript
try {
  await db.getCanvasNodes(userId);
} catch (error) {
  if (error.message === 'Database not initialized') {
    // Initialize database first
    await initializeDatabase();
  } else if (error.message === 'Permission denied') {
    // User doesn't have access
    console.error('Access denied');
  } else {
    // Other database errors
    console.error('Database error:', error);
  }
}
```

---

## Performance Tips

### 1. Use Indexed Columns in Queries

All `user_id` columns are indexed - filter by user for best performance.

### 2. Batch Operations

For multiple updates, perform them together to reduce I/O.

### 3. Limit Results

```typescript
// Get limited activity log
const activities = await db.getActivityLog(userId, 50); // Instead of 1000
```

### 4. Use FTS5 for Text Search

For text-heavy searches, consider using FTS5 virtual tables directly in custom queries.

---

## Testing

### Running Tests

```bash
# All tests
npm test

# Database tests only
npm run test:database-features
```

### Test Coverage

✅ 119 database tests covering:
- Turso DB configuration
- Persistent storage
- Semantic search
- SQL indexing
- Multi-user support
- ACL system
- Full-text search
- Activity logging
- All data models

---

## Troubleshooting

### Database Not Initialized

**Error:** `Database not initialized. Call initializeDatabase first.`

**Solution:**
```typescript
import { initializeDatabase } from '@/services/database';
await initializeDatabase();
```

### Migration Errors

**Error:** Migration fails to apply

**Solution:**
1. Check migration SQL syntax
2. Ensure migration is idempotent
3. Check database permissions
4. Review migration logs

### Permission Denied

**Error:** `Permission denied`

**Solution:**
1. Check user role (admin bypasses ACL)
2. Verify ACL entries for resource
3. Check if user owns the resource

### File Not Found (Electron)

**Error:** Database file not found

**Solution:**
Database is stored in `app.getPath('userData')`. Check Electron userData path.

---

## Additional Resources

- **Full Documentation:** `DATABASE_VERIFICATION_REPORT.md`
- **Database Service:** `src/services/database.ts`
- **Schema:** `src/services/schema.sql`
- **Migrations:** `src/services/migrations/`
- **Tests:** `scripts/verify-database-features.js`

---

**Last Updated:** 2026-01-05  
**Version:** 1.0.0
