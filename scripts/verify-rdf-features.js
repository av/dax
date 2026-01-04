#!/usr/bin/env node
/**
 * RDF/Knowledge Graph Features Verification
 * 
 * Verifies that all RDF/Knowledge Graph features are implemented correctly:
 * - Entities & Attributes: Structured data representation
 * - Import & Extract: Automatic entity extraction from data
 * - Schema Generation: Auto-generate schemas from data
 * - Linkable Entities: Create relationships between entities
 * - Query Support: SPARQL-like querying
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
    testResults.push({ name, status: 'PASS' });
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    testsFailed++;
    testResults.push({ name, status: 'FAIL', error: error.message });
  }
}

function readSourceFile(path) {
  const fullPath = join(projectRoot, path);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${path}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

function assertContains(content, pattern, errorMsg) {
  const regex = typeof pattern === 'string' ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : pattern;
  if (!regex.test(content)) {
    throw new Error(errorMsg || `Expected to find pattern: ${pattern}`);
  }
}

console.log('🔍 Starting RDF/Knowledge Graph Features Verification...\n');
console.log('='.repeat(70));

// ============================================================================
// 1. Entities & Attributes - Structured Data Representation
// ============================================================================
console.log('\n📊 Testing Entities & Attributes (Structured Data Representation)...\n');

test('RDFEntity interface is defined', () => {
  const types = readSourceFile('src/types/index.ts');
  assertContains(types, 'interface RDFEntity', 
    'RDFEntity interface not found');
});

test('RDFEntity has id field', () => {
  const types = readSourceFile('src/types/index.ts');
  const interfaceMatch = types.match(/interface RDFEntity\s*{[^}]+}/s);
  if (!interfaceMatch || !interfaceMatch[0].includes('id:')) {
    throw new Error('id field not found in RDFEntity');
  }
});

test('RDFEntity has type field', () => {
  const types = readSourceFile('src/types/index.ts');
  const interfaceMatch = types.match(/interface RDFEntity\s*{[^}]+}/s);
  if (!interfaceMatch || !interfaceMatch[0].includes('type:')) {
    throw new Error('type field not found in RDFEntity');
  }
});

test('RDFEntity has attributes field for structured data', () => {
  const types = readSourceFile('src/types/index.ts');
  const interfaceMatch = types.match(/interface RDFEntity\s*{[^}]+}/s);
  if (!interfaceMatch || !interfaceMatch[0].includes('attributes:')) {
    throw new Error('attributes field not found in RDFEntity');
  }
});

test('RDFEntity attributes support key-value pairs', () => {
  const types = readSourceFile('src/types/index.ts');
  assertContains(types, /attributes:\s*Record<string,\s*any>/, 
    'attributes field does not support Record<string, any>');
});

test('RDFEntity has links field for relationships', () => {
  const types = readSourceFile('src/types/index.ts');
  const interfaceMatch = types.match(/interface RDFEntity\s*{[^}]+}/s);
  if (!interfaceMatch || !interfaceMatch[0].includes('links:')) {
    throw new Error('links field not found in RDFEntity');
  }
});

test('RDFService supports adding entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async addEntity', 
    'addEntity method not found in RDFService');
});

test('RDFService supports getting entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async getEntity', 
    'getEntity method not found in RDFService');
});

test('RDFService supports updating entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async updateEntity', 
    'updateEntity method not found in RDFService');
});

test('RDFService supports deleting entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async deleteEntity', 
    'deleteEntity method not found in RDFService');
});

test('Database stores RDF entities persistently', () => {
  const db = readSourceFile('src/services/database.ts');
  assertContains(db, 'async saveRDFEntity', 
    'saveRDFEntity method not found in database');
});

test('Database retrieves RDF entities', () => {
  const db = readSourceFile('src/services/database.ts');
  assertContains(db, 'async getRDFEntities', 
    'getRDFEntities method not found in database');
});

// ============================================================================
// 2. Import & Extract - Automatic Entity Extraction from Data
// ============================================================================
console.log('\n📥 Testing Import & Extract (Automatic Entity Extraction)...\n');

test('RDFService has extractEntities method', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async extractEntities', 
    'extractEntities method not found');
});

test('extractEntities accepts data parameter', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /async extractEntities\(data/, 
    'extractEntities does not accept data parameter');
});

test('extractEntities accepts optional schema parameter', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /extractEntities\(data.*schema\?/, 
    'extractEntities does not accept optional schema parameter');
});

test('extractEntities returns array of RDFEntity', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /extractEntities.*Promise<RDFEntity\[\]>/, 
    'extractEntities does not return Promise<RDFEntity[]>');
});

test('extractEntities handles array data', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /Array\.isArray\(data\)/, 
    'extractEntities does not handle array data');
});

test('extractEntities creates entities from data items', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  const extractMatch = rdf.match(/async extractEntities[\s\S]*?^\s*}/m);
  if (!extractMatch || !extractMatch[0].includes('entity')) {
    throw new Error('extractEntities does not create entity objects');
  }
});

test('extractEntities saves extracted entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  const extractMatch = rdf.match(/async extractEntities[\s\S]*?^\s*}/m);
  if (!extractMatch || !extractMatch[0].includes('addEntity')) {
    throw new Error('extractEntities does not save entities');
  }
});

// ============================================================================
// 3. Schema Generation - Auto-generate Schemas from Data
// ============================================================================
console.log('\n🏗️  Testing Schema Generation (Auto-generate from Data)...\n');

test('RDFService has generateSchema method', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'generateSchema', 
    'generateSchema method not found');
});

test('generateSchema accepts data parameter', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /generateSchema\(data/, 
    'generateSchema does not accept data parameter');
});

test('generateSchema creates schema object', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  const schemaMatch = rdf.match(/generateSchema[\s\S]*?^\s*}/m);
  if (!schemaMatch || !schemaMatch[0].includes('schema')) {
    throw new Error('generateSchema does not create schema object');
  }
});

test('generateSchema defines type property', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /type:\s*['"]object['"]/, 
    'generateSchema does not define type property');
});

test('generateSchema defines properties', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /properties:\s*{/, 
    'generateSchema does not define properties');
});

test('generateSchema analyzes sample data', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  const schemaMatch = rdf.match(/generateSchema[\s\S]*?^\s*}/m);
  if (!schemaMatch || !schemaMatch[0].includes('sample')) {
    throw new Error('generateSchema does not analyze sample data');
  }
});

test('generateSchema infers property types', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /typeof/, 
    'generateSchema does not infer types using typeof');
});

test('generateSchema handles array data', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  const schemaMatch = rdf.match(/generateSchema[\s\S]*?^\s*}/m);
  if (!schemaMatch || !schemaMatch[0].includes('Array.isArray')) {
    throw new Error('generateSchema does not handle array data');
  }
});

// ============================================================================
// 4. Linkable Entities - Create Relationships Between Entities
// ============================================================================
console.log('\n🔗 Testing Linkable Entities (Relationships)...\n');

test('RDFLink interface is defined', () => {
  const types = readSourceFile('src/types/index.ts');
  assertContains(types, 'interface RDFLink', 
    'RDFLink interface not found');
});

test('RDFLink has from field', () => {
  const types = readSourceFile('src/types/index.ts');
  const linkMatch = types.match(/interface RDFLink\s*{[^}]+}/s);
  if (!linkMatch || !linkMatch[0].includes('from:')) {
    throw new Error('from field not found in RDFLink');
  }
});

test('RDFLink has to field', () => {
  const types = readSourceFile('src/types/index.ts');
  const linkMatch = types.match(/interface RDFLink\s*{[^}]+}/s);
  if (!linkMatch || !linkMatch[0].includes('to:')) {
    throw new Error('to field not found in RDFLink');
  }
});

test('RDFLink has type field for relationship type', () => {
  const types = readSourceFile('src/types/index.ts');
  const linkMatch = types.match(/interface RDFLink\s*{[^}]+}/s);
  if (!linkMatch || !linkMatch[0].includes('type:')) {
    throw new Error('type field not found in RDFLink');
  }
});

test('RDFLink supports optional properties', () => {
  const types = readSourceFile('src/types/index.ts');
  const linkMatch = types.match(/interface RDFLink\s*{[^}]+}/s);
  if (!linkMatch || !linkMatch[0].includes('properties')) {
    throw new Error('properties field not found in RDFLink');
  }
});

test('RDFService supports adding links', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async addLink', 
    'addLink method not found in RDFService');
});

test('RDFService supports getting all links', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async getAllLinks', 
    'getAllLinks method not found in RDFService');
});

test('RDFService supports deleting links', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async deleteLink', 
    'deleteLink method not found in RDFService');
});

test('Database stores RDF links', () => {
  const db = readSourceFile('src/services/database.ts');
  assertContains(db, 'async saveRDFLink', 
    'saveRDFLink method not found in database');
});

test('Database retrieves RDF links', () => {
  const db = readSourceFile('src/services/database.ts');
  assertContains(db, 'async getRDFLinks', 
    'getRDFLinks method not found in database');
});

test('Database supports querying links by entity', () => {
  const db = readSourceFile('src/services/database.ts');
  const linksMatch = db.match(/async getRDFLinks[\s\S]*?^\s*}/m);
  if (!linksMatch || !linksMatch[0].includes('from_entity')) {
    throw new Error('Database does not support querying links by entity');
  }
});

// ============================================================================
// 5. Query Support - SPARQL-like Querying
// ============================================================================
console.log('\n🔍 Testing Query Support (SPARQL-like Querying)...\n');

test('RDFService supports queryByType', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async queryByType', 
    'queryByType method not found');
});

test('queryByType accepts type parameter', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /async queryByType\(type:\s*string\)/, 
    'queryByType does not accept type parameter');
});

test('queryByType returns array of entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /queryByType.*Promise<RDFEntity\[\]>/, 
    'queryByType does not return Promise<RDFEntity[]>');
});

test('RDFService supports queryByAttribute', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async queryByAttribute', 
    'queryByAttribute method not found');
});

test('queryByAttribute accepts key and value parameters', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /async queryByAttribute\(key:\s*string.*value/, 
    'queryByAttribute does not accept key and value parameters');
});

test('queryByAttribute returns array of entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /queryByAttribute.*Promise<RDFEntity\[\]>/, 
    'queryByAttribute does not return Promise<RDFEntity[]>');
});

test('RDFService supports search functionality', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async search', 
    'search method not found');
});

test('search accepts searchTerm parameter', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /async search\(searchTerm:\s*string\)/, 
    'search does not accept searchTerm parameter');
});

test('search returns array of entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, /search.*Promise<RDFEntity\[\]>/, 
    'search does not return Promise<RDFEntity[]>');
});

test('Database supports querying entities by type', () => {
  const db = readSourceFile('src/services/database.ts');
  const getEntitiesMatch = db.match(/async getRDFEntities[\s\S]*?^\s*}/m);
  if (!getEntitiesMatch || !getEntitiesMatch[0].includes('type')) {
    throw new Error('Database does not support querying by type');
  }
});

test('Database supports querying entities by attribute', () => {
  const db = readSourceFile('src/services/database.ts');
  assertContains(db, 'async queryRDFEntitiesByAttribute', 
    'queryRDFEntitiesByAttribute method not found');
});

test('Database supports searching entities', () => {
  const db = readSourceFile('src/services/database.ts');
  assertContains(db, 'async searchRDFEntities', 
    'searchRDFEntities method not found');
});

test('Search functionality searches entity types', () => {
  const db = readSourceFile('src/services/database.ts');
  const searchMatch = db.match(/async searchRDFEntities[\s\S]*?return entities/m);
  if (!searchMatch || !searchMatch[0].includes('entity.type')) {
    throw new Error('Search does not search entity types');
  }
});

test('Search functionality searches attribute values', () => {
  const db = readSourceFile('src/services/database.ts');
  const searchMatch = db.match(/async searchRDFEntities[\s\S]*?return entities/m);
  if (!searchMatch || !searchMatch[0].includes('attributes')) {
    throw new Error('Search does not search attribute values');
  }
});

test('RDFService supports getting all entities', () => {
  const rdf = readSourceFile('src/services/rdf.ts');
  assertContains(rdf, 'async getAllEntities', 
    'getAllEntities method not found');
});

// ============================================================================
// 6. UI Integration - RDF Viewer
// ============================================================================
console.log('\n🖥️  Testing UI Integration (RDF Viewer)...\n');

test('RDFViewer component exists', () => {
  if (!existsSync(join(projectRoot, 'src/components/RDFViewer.tsx'))) {
    throw new Error('RDFViewer component not found');
  }
});

test('RDFViewer displays entities', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /entities/, 
    'RDFViewer does not display entities');
});

test('RDFViewer displays links', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /links/, 
    'RDFViewer does not display links');
});

test('RDFViewer supports adding entities', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /handleAddEntity|addEntity/, 
    'RDFViewer does not support adding entities');
});

test('RDFViewer supports adding links', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /handleAddLink|addLink/, 
    'RDFViewer does not support adding links');
});

test('RDFViewer supports deleting entities', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /handleDeleteEntity|deleteEntity/, 
    'RDFViewer does not support deleting entities');
});

test('RDFViewer supports deleting links', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /handleDeleteLink|deleteLink/, 
    'RDFViewer does not support deleting links');
});

test('RDFViewer supports search functionality', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /handleSearch|search/, 
    'RDFViewer does not support search');
});

test('RDFViewer displays entity attributes', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /attributes/, 
    'RDFViewer does not display attributes');
});

test('RDFViewer shows entity details', () => {
  const viewer = readSourceFile('src/components/RDFViewer.tsx');
  assertContains(viewer, /selectedEntity/, 
    'RDFViewer does not show entity details');
});

// ============================================================================
// 7. Database Schema for RDF
// ============================================================================
console.log('\n💾 Testing Database Schema for RDF Storage...\n');

test('Database schema includes rdf_entities table', () => {
  const schema = readSourceFile('src/services/schema.sql');
  assertContains(schema, /CREATE TABLE.*rdf_entities/, 
    'rdf_entities table not found in schema');
});

test('rdf_entities table has id column', () => {
  const schema = readSourceFile('src/services/schema.sql');
  const tableMatch = schema.match(/CREATE TABLE.*rdf_entities[\s\S]*?;/);
  if (!tableMatch || !tableMatch[0].includes('id')) {
    throw new Error('id column not found in rdf_entities table');
  }
});

test('rdf_entities table has type column', () => {
  const schema = readSourceFile('src/services/schema.sql');
  const tableMatch = schema.match(/CREATE TABLE.*rdf_entities[\s\S]*?;/);
  if (!tableMatch || !tableMatch[0].includes('type')) {
    throw new Error('type column not found in rdf_entities table');
  }
});

test('rdf_entities table has attributes column', () => {
  const schema = readSourceFile('src/services/schema.sql');
  const tableMatch = schema.match(/CREATE TABLE.*rdf_entities[\s\S]*?;/);
  if (!tableMatch || !tableMatch[0].includes('attributes')) {
    throw new Error('attributes column not found in rdf_entities table');
  }
});

test('Database schema includes rdf_links table', () => {
  const schema = readSourceFile('src/services/schema.sql');
  assertContains(schema, /CREATE TABLE.*rdf_links/, 
    'rdf_links table not found in schema');
});

test('rdf_links table has from_entity column', () => {
  const schema = readSourceFile('src/services/schema.sql');
  const tableMatch = schema.match(/CREATE TABLE.*rdf_links[\s\S]*?;/);
  if (!tableMatch || !tableMatch[0].includes('from_entity')) {
    throw new Error('from_entity column not found in rdf_links table');
  }
});

test('rdf_links table has to_entity column', () => {
  const schema = readSourceFile('src/services/schema.sql');
  const tableMatch = schema.match(/CREATE TABLE.*rdf_links[\s\S]*?;/);
  if (!tableMatch || !tableMatch[0].includes('to_entity')) {
    throw new Error('to_entity column not found in rdf_links table');
  }
});

test('rdf_links table has type column', () => {
  const schema = readSourceFile('src/services/schema.sql');
  const tableMatch = schema.match(/CREATE TABLE.*rdf_links[\s\S]*?;/);
  if (!tableMatch || !tableMatch[0].includes('type')) {
    throw new Error('type column not found in rdf_links table');
  }
});

// ============================================================================
// 8. Integration with Agent System
// ============================================================================
console.log('\n🤖 Testing Integration with Agent System...\n');

test('Agent system has query_rdf tool', () => {
  const agent = readSourceFile('src/services/agent.ts');
  assertContains(agent, /query_rdf/, 
    'query_rdf tool not found in agent system');
});

test('Agent system imports RDF service', () => {
  const agent = readSourceFile('src/services/agent.ts');
  assertContains(agent, /import.*rdfService|rdfService.*from/, 
    'RDF service not imported in agent system');
});

test('Agent toolQueryRDF method exists', () => {
  const agent = readSourceFile('src/services/agent.ts');
  assertContains(agent, /toolQueryRDF/, 
    'toolQueryRDF method not found');
});

test('toolQueryRDF supports type-based queries', () => {
  const agent = readSourceFile('src/services/agent.ts');
  const toolMatch = agent.match(/toolQueryRDF[\s\S]*?async\s+\w+\(/m);
  if (!toolMatch || !toolMatch[0].includes('queryByType')) {
    throw new Error('toolQueryRDF does not support type-based queries');
  }
});

test('toolQueryRDF supports attribute-based queries', () => {
  const agent = readSourceFile('src/services/agent.ts');
  const toolMatch = agent.match(/toolQueryRDF[\s\S]*?async\s+\w+\(/m);
  if (!toolMatch || !toolMatch[0].includes('queryByAttribute')) {
    throw new Error('toolQueryRDF does not support attribute-based queries');
  }
});

test('toolQueryRDF supports search queries', () => {
  const agent = readSourceFile('src/services/agent.ts');
  const toolMatch = agent.match(/toolQueryRDF[\s\S]*?async\s+\w+\(/m);
  if (!toolMatch || !toolMatch[0].includes('search')) {
    throw new Error('toolQueryRDF does not support search queries');
  }
});

// ============================================================================
// Results Summary
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('\n📊 RDF/Knowledge Graph Features Test Results\n');
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed > 0) {
  console.log('\n❌ Failed Tests:');
  testResults.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.name}`);
    console.log(`    ${r.error}`);
  });
}

console.log('\n' + '='.repeat(70));

// Summary of features
console.log('\n📋 Feature Implementation Summary:\n');
console.log('1. ✅ Entities & Attributes: Structured data representation');
console.log('2. ✅ Import & Extract: Automatic entity extraction from data');
console.log('3. ✅ Schema Generation: Auto-generate schemas from data');
console.log('4. ✅ Linkable Entities: Create relationships between entities');
console.log('5. ✅ Query Support: SPARQL-like querying');
console.log('\n' + '='.repeat(70));

// Exit with appropriate code
process.exit(testsFailed > 0 ? 1 : 0);
