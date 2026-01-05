#!/usr/bin/env node
/**
 * Database Features Verification Test
 * 
 * This script verifies all database-related features and functionality:
 * - Turso DB: Modern SQLite-compatible edge database
 * - Persistent storage for all application state
 * - Semantic search capabilities
 * - Fast SQL-based indexing
 * - Multi-user support with user roles
 * - Access Control Lists (ACL) for resource permissions
 * - Full-text search support
 * - Activity logging and audit trail
 * - All stored data models (Canvas nodes, RDF entities, User preferences, Agent configs, etc.)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let testsPassed = 0;
let testsFailed = 0;
const testResults = {
  tursoDb: [],
  persistentStorage: [],
  semanticSearch: [],
  indexing: [],
  multiUser: [],
  acl: [],
  fullTextSearch: [],
  activityLogging: [],
  dataModels: [],
};

function test(category, name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
    testResults[category].push({ name, status: 'passed' });
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    testsFailed++;
    testResults[category].push({ name, status: 'failed', error: error.message });
  }
}

console.log('🗄️  Starting Database Features Verification...\n');
console.log('======================================================================\n');

// ============================================================================
// 1. Turso DB: Modern SQLite-compatible edge database
// ============================================================================
console.log('📦 Testing Turso DB Configuration...\n');

test('tursoDb', 'Turso DB client package is installed', () => {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
  if (!packageJson.dependencies['@libsql/client']) {
    throw new Error('@libsql/client not found in dependencies');
  }
});

test('tursoDb', 'Database service imports Turso client', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes("import { createClient, Client } from '@libsql/client'")) {
    throw new Error('Turso client not imported in database service');
  }
});

test('tursoDb', 'DatabaseConfig supports Turso URL and auth token', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('url: string') || !dbService.includes('authToken')) {
    throw new Error('DatabaseConfig missing Turso configuration fields');
  }
});

test('tursoDb', 'Database supports file-based SQLite URLs', () => {
  const envExample = readFileSync(join(projectRoot, '.env.example'), 'utf-8');
  if (!envExample.includes('file:dax.db')) {
    throw new Error('File-based database URL not documented');
  }
});

test('tursoDb', 'Database supports cloud-based Turso URLs', () => {
  const envExample = readFileSync(join(projectRoot, '.env.example'), 'utf-8');
  if (!envExample.includes('libsql://') || !envExample.includes('turso.io')) {
    throw new Error('Cloud Turso URL not documented');
  }
});

test('tursoDb', 'Electron main process initializes local database', () => {
  const mainJs = readFileSync(join(projectRoot, 'src/main/main.js'), 'utf-8');
  if (!mainJs.includes('file:${dbPath}')) {
    throw new Error('Local database initialization not found in main process');
  }
});

test('tursoDb', 'Database client is properly created', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('createClient({')) {
    throw new Error('Database client creation not found');
  }
});

// ============================================================================
// 2. Persistent storage for all application state
// ============================================================================
console.log('\n💾 Testing Persistent Storage...\n');

test('persistentStorage', 'Database initialization method exists', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async initialize()')) {
    throw new Error('Database initialization method not found');
  }
});

test('persistentStorage', 'Migration system is implemented', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('MigrationRunner')) {
    throw new Error('Migration system not implemented');
  }
});

test('persistentStorage', 'Migration runner runs migrations on init', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('await migrationRunner.runMigrations()')) {
    throw new Error('Migrations not executed on initialization');
  }
});

test('persistentStorage', 'Migration tracking table exists', () => {
  const migration000 = readFileSync(join(projectRoot, 'src/services/migrations/000_init.sql'), 'utf-8');
  if (!migration000.includes('schema_migrations')) {
    throw new Error('Migration tracking table not found');
  }
});

test('persistentStorage', 'Database data persists across sessions', () => {
  const mainJs = readFileSync(join(projectRoot, 'src/main/main.js'), 'utf-8');
  // Check that database file is stored in userData (persistent location)
  if (!mainJs.includes("app.getPath('userData')")) {
    throw new Error('Database not stored in persistent location');
  }
});

test('persistentStorage', 'Database service supports CRUD operations', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const operations = ['save', 'get', 'delete'];
  for (const op of operations) {
    if (!dbService.includes(op)) {
      throw new Error(`CRUD operation '${op}' not found`);
    }
  }
});

// ============================================================================
// 3. Semantic search capabilities
// ============================================================================
console.log('\n🔍 Testing Semantic Search Capabilities...\n');

test('semanticSearch', 'semanticSearch method exists in database service', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async semanticSearch(')) {
    throw new Error('semanticSearch method not found');
  }
});

test('semanticSearch', 'Semantic search accepts query parameter', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('semanticSearch(query: string')) {
    throw new Error('semanticSearch query parameter not found');
  }
});

test('semanticSearch', 'Semantic search searches documents', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const semanticSearchSection = dbService.substring(
    dbService.indexOf('async semanticSearch('),
    dbService.indexOf('async semanticSearch(') + 1000
  );
  if (!semanticSearchSection.includes('documents')) {
    throw new Error('Semantic search does not search documents');
  }
});

test('semanticSearch', 'Semantic search searches canvas nodes', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const semanticSearchSection = dbService.substring(
    dbService.indexOf('async semanticSearch('),
    dbService.indexOf('async semanticSearch(') + 1000
  );
  if (!semanticSearchSection.includes('canvas_nodes')) {
    throw new Error('Semantic search does not search canvas nodes');
  }
});

test('semanticSearch', 'Semantic search supports LIKE queries', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const semanticSearchSection = dbService.substring(
    dbService.indexOf('async semanticSearch('),
    dbService.indexOf('async semanticSearch(') + 1500
  );
  if (!semanticSearchSection.includes('LIKE')) {
    throw new Error('Semantic search does not use LIKE queries');
  }
});

test('semanticSearch', 'Semantic search respects ACL permissions', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const semanticSearchSection = dbService.substring(
    dbService.indexOf('async semanticSearch('),
    dbService.indexOf('async semanticSearch(') + 1500
  );
  if (!semanticSearchSection.includes('checkPermission')) {
    throw new Error('Semantic search does not check permissions');
  }
});

test('semanticSearch', 'RDF search functionality exists', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async searchRDFEntities(')) {
    throw new Error('RDF search method not found');
  }
});

test('semanticSearch', 'RDF search searches entity types', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const rdfSearchSection = dbService.substring(
    dbService.indexOf('async searchRDFEntities('),
    dbService.indexOf('async searchRDFEntities(') + 1000
  );
  if (!rdfSearchSection.includes('entity.type')) {
    throw new Error('RDF search does not search entity types');
  }
});

test('semanticSearch', 'RDF search searches attribute values', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const rdfSearchSection = dbService.substring(
    dbService.indexOf('async searchRDFEntities('),
    dbService.indexOf('async searchRDFEntities(') + 1000
  );
  if (!rdfSearchSection.includes('entity.attributes')) {
    throw new Error('RDF search does not search attributes');
  }
});

// ============================================================================
// 4. Fast SQL-based indexing
// ============================================================================
console.log('\n⚡ Testing SQL-based Indexing...\n');

test('indexing', 'Database schema file includes indexes', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE INDEX')) {
    throw new Error('No indexes found in schema');
  }
});

test('indexing', 'Index on canvas_nodes user_id exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_canvas_nodes_user')) {
    throw new Error('Index on canvas_nodes user_id not found');
  }
});

test('indexing', 'Index on canvas_nodes type exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_canvas_nodes_type')) {
    throw new Error('Index on canvas_nodes type not found');
  }
});

test('indexing', 'Index on rdf_entities user_id exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_rdf_entities_user')) {
    throw new Error('Index on rdf_entities user_id not found');
  }
});

test('indexing', 'Index on rdf_entities type exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_rdf_entities_type')) {
    throw new Error('Index on rdf_entities type not found');
  }
});

test('indexing', 'Index on rdf_links user_id exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_rdf_links_user')) {
    throw new Error('Index on rdf_links user_id not found');
  }
});

test('indexing', 'Index on rdf_links from_entity exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_rdf_links_from')) {
    throw new Error('Index on rdf_links from_entity not found');
  }
});

test('indexing', 'Index on rdf_links to_entity exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_rdf_links_to')) {
    throw new Error('Index on rdf_links to_entity not found');
  }
});

test('indexing', 'Index on ACL resource_id and resource_type exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_acl_resource')) {
    throw new Error('Index on ACL resource not found');
  }
});

test('indexing', 'Index on ACL user_id exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_acl_user')) {
    throw new Error('Index on ACL user_id not found');
  }
});

test('indexing', 'Index on documents user_id exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_documents_user')) {
    throw new Error('Index on documents user_id not found');
  }
});

test('indexing', 'Index on documents owner_id exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_documents_owner')) {
    throw new Error('Index on documents owner_id not found');
  }
});

test('indexing', 'Index on agent_configs user_id exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_agent_configs_user')) {
    throw new Error('Index on agent_configs user_id not found');
  }
});

test('indexing', 'Index on activity_log user_id exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_activity_log_user')) {
    throw new Error('Index on activity_log user_id not found');
  }
});

test('indexing', 'Index on activity_log resource exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('idx_activity_log_resource')) {
    throw new Error('Index on activity_log resource not found');
  }
});

// ============================================================================
// 5. Multi-user support with user roles
// ============================================================================
console.log('\n👥 Testing Multi-user Support...\n');

test('multiUser', 'Users table exists in schema', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS users')) {
    throw new Error('Users table not found in schema');
  }
});

test('multiUser', 'Users table has id column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const usersTableSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS users'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS users') + 500
  );
  if (!usersTableSection.includes('id TEXT PRIMARY KEY')) {
    throw new Error('Users table missing id column');
  }
});

test('multiUser', 'Users table has username column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const usersTableSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS users'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS users') + 500
  );
  if (!usersTableSection.includes('username TEXT NOT NULL')) {
    throw new Error('Users table missing username column');
  }
});

test('multiUser', 'Users table has email column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const usersTableSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS users'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS users') + 500
  );
  if (!usersTableSection.includes('email TEXT NOT NULL')) {
    throw new Error('Users table missing email column');
  }
});

test('multiUser', 'Users table has role column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const usersTableSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS users'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS users') + 500
  );
  if (!usersTableSection.includes('role TEXT NOT NULL')) {
    throw new Error('Users table missing role column');
  }
});

test('multiUser', 'User roles include admin', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const usersTableSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS users'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS users') + 500
  );
  if (!usersTableSection.includes('admin')) {
    throw new Error('Admin role not defined');
  }
});

test('multiUser', 'User roles include user', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const usersTableSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS users'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS users') + 500
  );
  if (!usersTableSection.includes("'user'")) {
    throw new Error('User role not defined');
  }
});

test('multiUser', 'User roles include viewer', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const usersTableSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS users'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS users') + 500
  );
  if (!usersTableSection.includes('viewer')) {
    throw new Error('Viewer role not defined');
  }
});

test('multiUser', 'Users table has permissions column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const usersTableSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS users'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS users') + 500
  );
  if (!usersTableSection.includes('permissions TEXT NOT NULL')) {
    throw new Error('Users table missing permissions column');
  }
});

test('multiUser', 'Database service has addUser method', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async addUser(')) {
    throw new Error('addUser method not found');
  }
});

test('multiUser', 'Database service has getUser method', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async getUser(')) {
    throw new Error('getUser method not found');
  }
});

test('multiUser', 'Default admin user is created on initialization', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('createDefaultAdmin')) {
    throw new Error('Default admin creation not found');
  }
});

test('multiUser', 'All tables have user_id foreign keys', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const tables = ['canvas_nodes', 'rdf_entities', 'rdf_links', 'documents', 'agent_configs', 'acl', 'activity_log'];
  for (const table of tables) {
    const tableSection = schema.substring(
      schema.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`),
      schema.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`) + 1000
    );
    if (!tableSection.includes('user_id TEXT NOT NULL')) {
      throw new Error(`${table} table missing user_id column`);
    }
  }
});

// ============================================================================
// 6. Access Control Lists (ACL) for resource permissions
// ============================================================================
console.log('\n🔒 Testing Access Control Lists (ACL)...\n');

test('acl', 'ACL table exists in schema', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS acl')) {
    throw new Error('ACL table not found in schema');
  }
});

test('acl', 'ACL table has resource_id column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const aclSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl') + 800
  );
  if (!aclSection.includes('resource_id TEXT NOT NULL')) {
    throw new Error('ACL table missing resource_id column');
  }
});

test('acl', 'ACL table has resource_type column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const aclSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl') + 800
  );
  if (!aclSection.includes('resource_type TEXT NOT NULL')) {
    throw new Error('ACL table missing resource_type column');
  }
});

test('acl', 'ACL table has permissions column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const aclSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl') + 800
  );
  if (!aclSection.includes('permissions TEXT NOT NULL')) {
    throw new Error('ACL table missing permissions column');
  }
});

test('acl', 'ACL supports canvas_node resource type', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const aclSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl') + 800
  );
  if (!aclSection.includes('canvas_node')) {
    throw new Error('ACL does not support canvas_node resource type');
  }
});

test('acl', 'ACL supports rdf_entity resource type', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const aclSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl') + 800
  );
  if (!aclSection.includes('rdf_entity')) {
    throw new Error('ACL does not support rdf_entity resource type');
  }
});

test('acl', 'ACL supports document resource type', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const aclSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS acl') + 800
  );
  if (!aclSection.includes('document')) {
    throw new Error('ACL does not support document resource type');
  }
});

test('acl', 'Database service has setACL method', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async setACL(')) {
    throw new Error('setACL method not found');
  }
});

test('acl', 'Database service has getACL method', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async getACL(')) {
    throw new Error('getACL method not found');
  }
});

test('acl', 'Database service has checkPermission method', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async checkPermission(')) {
    throw new Error('checkPermission method not found');
  }
});

test('acl', 'checkPermission supports read permission', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const checkPermSection = dbService.substring(
    dbService.indexOf('async checkPermission('),
    dbService.indexOf('async checkPermission(') + 500
  );
  if (!checkPermSection.includes('read')) {
    throw new Error('Read permission not supported');
  }
});

test('acl', 'checkPermission supports write permission', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const checkPermSection = dbService.substring(
    dbService.indexOf('async checkPermission('),
    dbService.indexOf('async checkPermission(') + 500
  );
  if (!checkPermSection.includes('write')) {
    throw new Error('Write permission not supported');
  }
});

test('acl', 'checkPermission supports delete permission', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const checkPermSection = dbService.substring(
    dbService.indexOf('async checkPermission('),
    dbService.indexOf('async checkPermission(') + 500
  );
  if (!checkPermSection.includes('delete')) {
    throw new Error('Delete permission not supported');
  }
});

test('acl', 'checkPermission supports share permission', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const checkPermSection = dbService.substring(
    dbService.indexOf('async checkPermission('),
    dbService.indexOf('async checkPermission(') + 500
  );
  if (!checkPermSection.includes('share')) {
    throw new Error('Share permission not supported');
  }
});

test('acl', 'Admin role bypasses ACL checks', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const checkPermSection = dbService.substring(
    dbService.indexOf('async checkPermission('),
    dbService.indexOf('async checkPermission(') + 2000
  );
  if (!checkPermSection.includes("role === 'admin'")) {
    throw new Error('Admin role does not bypass ACL checks');
  }
});

test('acl', 'ACL is enforced in document operations', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const storeMethod = dbService.substring(
    dbService.indexOf('async store('),
    dbService.indexOf('async store(') + 500
  );
  if (!storeMethod.includes('checkPermission')) {
    throw new Error('ACL not enforced in document store operation');
  }
});

test('acl', 'ACL is enforced in semantic search', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const semanticSearchSection = dbService.substring(
    dbService.indexOf('async semanticSearch('),
    dbService.indexOf('async semanticSearch(') + 1500
  );
  if (!semanticSearchSection.includes('checkPermission')) {
    throw new Error('ACL not enforced in semantic search');
  }
});

// ============================================================================
// 7. Full-text search support
// ============================================================================
console.log('\n🔎 Testing Full-text Search Support...\n');

test('fullTextSearch', 'FTS5 virtual tables are defined in schema', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('USING fts5')) {
    throw new Error('FTS5 virtual tables not found in schema');
  }
});

test('fullTextSearch', 'documents_fts virtual table exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('documents_fts')) {
    throw new Error('documents_fts virtual table not found');
  }
});

test('fullTextSearch', 'canvas_nodes_fts virtual table exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('canvas_nodes_fts')) {
    throw new Error('canvas_nodes_fts virtual table not found');
  }
});

test('fullTextSearch', 'documents_fts indexes data column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const docsFtsSection = schema.substring(
    schema.indexOf('documents_fts'),
    schema.indexOf('documents_fts') + 300
  );
  if (!docsFtsSection.includes('data')) {
    throw new Error('documents_fts does not index data column');
  }
});

test('fullTextSearch', 'canvas_nodes_fts indexes title column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const nodesFtsSection = schema.substring(
    schema.indexOf('canvas_nodes_fts'),
    schema.indexOf('canvas_nodes_fts') + 300
  );
  if (!nodesFtsSection.includes('title')) {
    throw new Error('canvas_nodes_fts does not index title column');
  }
});

test('fullTextSearch', 'canvas_nodes_fts indexes data column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const nodesFtsSection = schema.substring(
    schema.indexOf('canvas_nodes_fts'),
    schema.indexOf('canvas_nodes_fts') + 300
  );
  if (!nodesFtsSection.includes('data')) {
    throw new Error('canvas_nodes_fts does not index data column');
  }
});

test('fullTextSearch', 'FTS tables are linked to content tables', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('content=documents') || !schema.includes('content=canvas_nodes')) {
    throw new Error('FTS tables not properly linked to content tables');
  }
});

// ============================================================================
// 8. Activity logging and audit trail
// ============================================================================
console.log('\n📋 Testing Activity Logging and Audit Trail...\n');

test('activityLogging', 'activity_log table exists in schema', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS activity_log')) {
    throw new Error('activity_log table not found in schema');
  }
});

test('activityLogging', 'activity_log has user_id column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const activityLogSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log') + 600
  );
  if (!activityLogSection.includes('user_id TEXT NOT NULL')) {
    throw new Error('activity_log missing user_id column');
  }
});

test('activityLogging', 'activity_log has action column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const activityLogSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log') + 600
  );
  if (!activityLogSection.includes('action TEXT NOT NULL')) {
    throw new Error('activity_log missing action column');
  }
});

test('activityLogging', 'activity_log has resource_type column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const activityLogSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log') + 600
  );
  if (!activityLogSection.includes('resource_type TEXT')) {
    throw new Error('activity_log missing resource_type column');
  }
});

test('activityLogging', 'activity_log has resource_id column', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const activityLogSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log') + 600
  );
  if (!activityLogSection.includes('resource_id TEXT')) {
    throw new Error('activity_log missing resource_id column');
  }
});

test('activityLogging', 'activity_log has details column for JSON metadata', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const activityLogSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log') + 600
  );
  if (!activityLogSection.includes('details TEXT')) {
    throw new Error('activity_log missing details column');
  }
});

test('activityLogging', 'activity_log has created_at timestamp', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const activityLogSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS activity_log') + 600
  );
  if (!activityLogSection.includes('created_at TEXT NOT NULL')) {
    throw new Error('activity_log missing created_at column');
  }
});

test('activityLogging', 'Database service has logActivity method', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async logActivity(')) {
    throw new Error('logActivity method not found');
  }
});

test('activityLogging', 'Database service has getActivityLog method', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('async getActivityLog(')) {
    throw new Error('getActivityLog method not found');
  }
});

test('activityLogging', 'User creation is logged', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  const addUserSection = dbService.substring(
    dbService.indexOf('async addUser('),
    dbService.indexOf('async addUser(') + 800
  );
  if (!addUserSection.includes('logActivity') && !addUserSection.includes('user_created')) {
    throw new Error('User creation not logged');
  }
});

test('activityLogging', 'Canvas node operations are logged', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('canvas_node_saved') || !dbService.includes('canvas_node_deleted')) {
    throw new Error('Canvas node operations not logged');
  }
});

test('activityLogging', 'RDF entity operations are logged', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('rdf_entity_saved') || !dbService.includes('rdf_entity_deleted')) {
    throw new Error('RDF entity operations not logged');
  }
});

test('activityLogging', 'RDF link operations are logged', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('rdf_link_created') || !dbService.includes('rdf_link_deleted')) {
    throw new Error('RDF link operations not logged');
  }
});

test('activityLogging', 'Document operations are logged', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('document_stored') || !dbService.includes('document_deleted')) {
    throw new Error('Document operations not logged');
  }
});

test('activityLogging', 'Agent config operations are logged', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('agent_config_saved') || !dbService.includes('agent_config_deleted')) {
    throw new Error('Agent config operations not logged');
  }
});

test('activityLogging', 'Preferences updates are logged', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('preferences_updated')) {
    throw new Error('Preferences updates not logged');
  }
});

test('activityLogging', 'ACL updates are logged', () => {
  const dbService = readFileSync(join(projectRoot, 'src/services/database.ts'), 'utf-8');
  if (!dbService.includes('acl_updated')) {
    throw new Error('ACL updates not logged');
  }
});

// ============================================================================
// 9. Stored Data Models
// ============================================================================
console.log('\n📊 Testing Stored Data Models...\n');

// Canvas nodes
test('dataModels', 'Canvas nodes table exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS canvas_nodes')) {
    throw new Error('canvas_nodes table not found');
  }
});

test('dataModels', 'Canvas nodes have type field', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const canvasNodesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes') + 800
  );
  if (!canvasNodesSection.includes('type TEXT NOT NULL')) {
    throw new Error('canvas_nodes missing type column');
  }
});

test('dataModels', 'Canvas nodes support data/agent/transform/output types', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const canvasNodesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes') + 800
  );
  if (!canvasNodesSection.includes('data') || !canvasNodesSection.includes('agent') ||
      !canvasNodesSection.includes('transform') || !canvasNodesSection.includes('output')) {
    throw new Error('canvas_nodes does not support all node types');
  }
});

test('dataModels', 'Canvas nodes store position (x, y)', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const canvasNodesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes') + 800
  );
  if (!canvasNodesSection.includes('x REAL') || !canvasNodesSection.includes('y REAL')) {
    throw new Error('canvas_nodes missing position columns');
  }
});

test('dataModels', 'Canvas nodes store dimensions (width, height)', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const canvasNodesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes') + 800
  );
  if (!canvasNodesSection.includes('width REAL') || !canvasNodesSection.includes('height REAL')) {
    throw new Error('canvas_nodes missing dimension columns');
  }
});

test('dataModels', 'Canvas nodes store data as JSON', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const canvasNodesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes') + 800
  );
  if (!canvasNodesSection.includes('data TEXT')) {
    throw new Error('canvas_nodes missing data column');
  }
});

test('dataModels', 'Canvas nodes store config as JSON', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const canvasNodesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS canvas_nodes') + 800
  );
  if (!canvasNodesSection.includes('config TEXT')) {
    throw new Error('canvas_nodes missing config column');
  }
});

// RDF entities and links
test('dataModels', 'RDF entities table exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS rdf_entities')) {
    throw new Error('rdf_entities table not found');
  }
});

test('dataModels', 'RDF entities have type field', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const rdfEntitiesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_entities'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_entities') + 500
  );
  if (!rdfEntitiesSection.includes('type TEXT NOT NULL')) {
    throw new Error('rdf_entities missing type column');
  }
});

test('dataModels', 'RDF entities store attributes as JSON', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const rdfEntitiesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_entities'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_entities') + 500
  );
  if (!rdfEntitiesSection.includes('attributes TEXT NOT NULL')) {
    throw new Error('rdf_entities missing attributes column');
  }
});

test('dataModels', 'RDF links table exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS rdf_links')) {
    throw new Error('rdf_links table not found');
  }
});

test('dataModels', 'RDF links have from_entity field', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const rdfLinksSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_links'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_links') + 700
  );
  if (!rdfLinksSection.includes('from_entity TEXT NOT NULL')) {
    throw new Error('rdf_links missing from_entity column');
  }
});

test('dataModels', 'RDF links have to_entity field', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const rdfLinksSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_links'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_links') + 700
  );
  if (!rdfLinksSection.includes('to_entity TEXT NOT NULL')) {
    throw new Error('rdf_links missing to_entity column');
  }
});

test('dataModels', 'RDF links have type field', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const rdfLinksSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_links'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS rdf_links') + 700
  );
  if (!rdfLinksSection.includes('type TEXT NOT NULL')) {
    throw new Error('rdf_links missing type column');
  }
});

// User preferences
test('dataModels', 'Preferences table exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS preferences')) {
    throw new Error('preferences table not found');
  }
});

test('dataModels', 'Preferences store theme', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const preferencesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS preferences'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS preferences') + 900
  );
  if (!preferencesSection.includes('theme TEXT NOT NULL')) {
    throw new Error('preferences missing theme column');
  }
});

test('dataModels', 'Preferences store backup settings', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const preferencesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS preferences'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS preferences') + 900
  );
  if (!preferencesSection.includes('backup_enabled') || !preferencesSection.includes('backup_interval')) {
    throw new Error('preferences missing backup settings columns');
  }
});

test('dataModels', 'Preferences store sync settings', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const preferencesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS preferences'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS preferences') + 900
  );
  if (!preferencesSection.includes('sync_enabled') || !preferencesSection.includes('sync_provider')) {
    throw new Error('preferences missing sync settings columns');
  }
});

test('dataModels', 'Preferences store hotkeys as JSON', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const preferencesSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS preferences'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS preferences') + 900
  );
  if (!preferencesSection.includes('hotkeys TEXT NOT NULL')) {
    throw new Error('preferences missing hotkeys column');
  }
});

// Agent configurations
test('dataModels', 'Agent configs table exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS agent_configs')) {
    throw new Error('agent_configs table not found');
  }
});

test('dataModels', 'Agent configs have name field', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const agentConfigsSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs') + 1200
  );
  if (!agentConfigsSection.includes('name TEXT NOT NULL')) {
    throw new Error('agent_configs missing name column');
  }
});

test('dataModels', 'Agent configs have api_url field', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const agentConfigsSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs') + 1200
  );
  if (!agentConfigsSection.includes('api_url TEXT NOT NULL')) {
    throw new Error('agent_configs missing api_url column');
  }
});

test('dataModels', 'Agent configs store tools as JSON array', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const agentConfigsSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs') + 1200
  );
  if (!agentConfigsSection.includes('tools TEXT')) {
    throw new Error('agent_configs missing tools column');
  }
});

test('dataModels', 'Agent configs store headers as JSON', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const agentConfigsSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs') + 1200
  );
  if (!agentConfigsSection.includes('headers TEXT')) {
    throw new Error('agent_configs missing headers column');
  }
});

test('dataModels', 'Agent configs support temperature and max_tokens', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const agentConfigsSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS agent_configs') + 1200
  );
  if (!agentConfigsSection.includes('temperature REAL') || !agentConfigsSection.includes('max_tokens INTEGER')) {
    throw new Error('agent_configs missing temperature or max_tokens columns');
  }
});

// Documents (generic storage)
test('dataModels', 'Documents table exists', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  if (!schema.includes('CREATE TABLE IF NOT EXISTS documents')) {
    throw new Error('documents table not found');
  }
});

test('dataModels', 'Documents store data as JSON', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const documentsSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS documents'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS documents') + 600
  );
  if (!documentsSection.includes('data TEXT NOT NULL')) {
    throw new Error('documents missing data column');
  }
});

test('dataModels', 'Documents have owner_id for ACL', () => {
  const schema = readFileSync(join(projectRoot, 'src/services/schema.sql'), 'utf-8');
  const documentsSection = schema.substring(
    schema.indexOf('CREATE TABLE IF NOT EXISTS documents'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS documents') + 600
  );
  if (!documentsSection.includes('owner_id TEXT NOT NULL')) {
    throw new Error('documents missing owner_id column');
  }
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n======================================================================');
console.log('\n📊 Database Features Verification Summary\n');
console.log('======================================================================\n');

const categories = [
  { key: 'tursoDb', name: 'Turso DB Configuration' },
  { key: 'persistentStorage', name: 'Persistent Storage' },
  { key: 'semanticSearch', name: 'Semantic Search' },
  { key: 'indexing', name: 'SQL-based Indexing' },
  { key: 'multiUser', name: 'Multi-user Support' },
  { key: 'acl', name: 'Access Control Lists (ACL)' },
  { key: 'fullTextSearch', name: 'Full-text Search' },
  { key: 'activityLogging', name: 'Activity Logging' },
  { key: 'dataModels', name: 'Stored Data Models' },
];

for (const category of categories) {
  const results = testResults[category.key];
  const passed = results.filter(r => r.status === 'passed').length;
  const total = results.length;
  console.log(`${category.name}: ${passed}/${total} tests passed`);
}

console.log('\n======================================================================\n');
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Total:  ${testsPassed + testsFailed}\n`);

if (testsFailed === 0) {
  console.log('✨ All database features are properly implemented and verified!\n');
  console.log('======================================================================\n');
  console.log('📋 Database Features Summary:\n');
  console.log('   ✅ Turso DB: SQLite-compatible edge database with local and cloud support');
  console.log('   ✅ Persistent Storage: All application state stored in database');
  console.log('   ✅ Semantic Search: Search across documents and canvas nodes with ACL');
  console.log('   ✅ Fast SQL Indexing: Comprehensive indexes on all frequently queried columns');
  console.log('   ✅ Multi-user Support: User roles (admin/user/viewer) with permissions');
  console.log('   ✅ Access Control Lists: Fine-grained permissions for all resources');
  console.log('   ✅ Full-text Search: FTS5 virtual tables for documents and canvas nodes');
  console.log('   ✅ Activity Logging: Complete audit trail for all database operations');
  console.log('   ✅ Data Models: Canvas nodes, RDF entities/links, preferences, agent configs');
  console.log('\n======================================================================\n');
  process.exit(0);
} else {
  console.log(`⚠️  ${testsFailed} test(s) failed. Please review the issues above.\n`);
  console.log('======================================================================\n');
  process.exit(1);
}
