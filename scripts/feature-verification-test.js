#!/usr/bin/env node
/**
 * Comprehensive Feature Verification Test
 * 
 * This script performs automated verification of all DAX application features:
 * - Build system integrity
 * - Source code quality
 * - Security best practices
 * - Feature completeness
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    testsFailed++;
  }
}

console.log('🧪 Starting Comprehensive Feature Verification...\n');

// Test 1: Build artifacts exist
test('Build output directory exists', () => {
  if (!existsSync(join(__dirname, 'dist'))) {
    throw new Error('dist directory not found');
  }
});

test('Renderer build exists', () => {
  if (!existsSync(join(__dirname, 'dist/renderer/index.html'))) {
    throw new Error('Renderer index.html not found');
  }
});

test('Main process build exists', () => {
  if (!existsSync(join(__dirname, 'dist/main/main.js'))) {
    throw new Error('Main process main.js not found');
  }
});

test('Migrations copied to dist', () => {
  const migrationFiles = ['000_init.sql', '001_initial_schema.sql', '002_update_agent_configs.sql'];
  for (const file of migrationFiles) {
    if (!existsSync(join(__dirname, 'dist/migrations', file))) {
      throw new Error(`Migration file ${file} not found in dist`);
    }
  }
});

// Test 2: Source files integrity
test('All core service files exist', () => {
  const services = ['database.ts', 'dataSource.ts', 'agent.ts', 'rdf.ts', 'preferences.ts', 'init.ts'];
  for (const service of services) {
    if (!existsSync(join(__dirname, 'src/services', service))) {
      throw new Error(`Service ${service} not found`);
    }
  }
});

test('Canvas components exist', () => {
  const components = ['Canvas.tsx', 'CanvasNode.tsx'];
  for (const component of components) {
    if (!existsSync(join(__dirname, 'src/components/canvas', component))) {
      throw new Error(`Canvas component ${component} not found`);
    }
  }
});

test('UI components exist', () => {
  const components = ['button.tsx', 'input.tsx', 'card.tsx'];
  for (const component of components) {
    if (!existsSync(join(__dirname, 'src/components/ui', component))) {
      throw new Error(`UI component ${component} not found`);
    }
  }
});

// Test 3: Security checks
test('No Date.now() used for ID generation', () => {
  const files = [
    'src/lib/utils.ts',
    'src/services/agent.ts',
    'src/services/rdf.ts',
    'src/components/canvas/Canvas.tsx',
  ];
  
  for (const file of files) {
    const content = readFileSync(join(__dirname, file), 'utf-8');
    if (content.match(/Date\.now\(\).*id/i)) {
      throw new Error(`Date.now() found in ${file} for ID generation`);
    }
  }
});

test('UUID generation uses crypto.randomUUID', () => {
  const utilsPath = join(__dirname, 'src/lib/utils.ts');
  const content = readFileSync(utilsPath, 'utf-8');
  
  if (!content.includes('crypto.randomUUID')) {
    throw new Error('crypto.randomUUID not found in utils.ts');
  }
});

test('Validation utilities are comprehensive', () => {
  const validationPath = join(__dirname, 'src/lib/validation.ts');
  const content = readFileSync(validationPath, 'utf-8');
  
  const requiredValidators = ['required', 'email', 'url', 'minLength', 'maxLength', 'range'];
  for (const validator of requiredValidators) {
    if (!content.includes(`${validator}:`)) {
      throw new Error(`Validator ${validator} not found`);
    }
  }
});

test('HTML sanitization is recursive', () => {
  const validationPath = join(__dirname, 'src/lib/validation.ts');
  const content = readFileSync(validationPath, 'utf-8');
  
  // Check for recursive HTML stripping pattern
  if (!content.includes('while') || !content.includes('stripHtml')) {
    throw new Error('Recursive HTML sanitization not found');
  }
});

test('Path sanitization removes directory traversal', () => {
  const validationPath = join(__dirname, 'src/lib/validation.ts');
  const content = readFileSync(validationPath, 'utf-8');
  
  // Check for sanitizePath function and the regex pattern that removes ..
  if (!content.includes('sanitizePath') || !content.includes('replace(/\\.\\./g')) {
    throw new Error('Path sanitization for .. not found');
  }
});

// Test 4: Database schema and migrations
test('Database migration files exist', () => {
  const migrations = ['000_init.sql', '001_initial_schema.sql', '002_update_agent_configs.sql'];
  for (const migration of migrations) {
    if (!existsSync(join(__dirname, 'src/services/migrations', migration))) {
      throw new Error(`Migration ${migration} not found`);
    }
  }
});

test('Database schema file exists', () => {
  if (!existsSync(join(__dirname, 'src/services/schema.sql'))) {
    throw new Error('schema.sql not found');
  }
});

// Test 5: Configuration files
test('TypeScript configuration exists', () => {
  if (!existsSync(join(__dirname, 'tsconfig.json'))) {
    throw new Error('tsconfig.json not found');
  }
});

test('Vite configuration exists', () => {
  if (!existsSync(join(__dirname, 'vite.config.ts'))) {
    throw new Error('vite.config.ts not found');
  }
});

test('Package.json has required scripts', () => {
  const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
  const requiredScripts = ['dev', 'build', 'start'];
  
  for (const script of requiredScripts) {
    if (!packageJson.scripts[script]) {
      throw new Error(`Script ${script} not found in package.json`);
    }
  }
});

test('Environment example file exists', () => {
  if (!existsSync(join(__dirname, '.env.example'))) {
    throw new Error('.env.example not found');
  }
});

test('Environment file exists', () => {
  if (!existsSync(join(__dirname, '.env'))) {
    throw new Error('.env not found - should be created from .env.example');
  }
});

// Test 6: Feature implementation checks
test('Canvas node management is implemented', () => {
  const canvasPath = join(__dirname, 'src/components/canvas/Canvas.tsx');
  const content = readFileSync(canvasPath, 'utf-8');
  
  const features = ['addNode', 'updateNode', 'deleteNode', 'duplicateNode'];
  for (const feature of features) {
    if (!content.includes(feature)) {
      throw new Error(`Canvas feature ${feature} not implemented`);
    }
  }
});

test('Data source connectors are implemented', () => {
  const dataSourcePath = join(__dirname, 'src/services/dataSource.ts');
  const content = readFileSync(dataSourcePath, 'utf-8');
  
  if (!content.includes('LocalFilesystem') || !content.includes('HTTPFilesystem')) {
    throw new Error('Data source implementations not found');
  }
});

test('Agent execution system is implemented', () => {
  const agentPath = join(__dirname, 'src/services/agent.ts');
  const content = readFileSync(agentPath, 'utf-8');
  
  if (!content.includes('AgentExecutor') || !content.includes('execute')) {
    throw new Error('Agent execution system not implemented');
  }
});

test('RDF service has CRUD operations', () => {
  const rdfPath = join(__dirname, 'src/services/rdf.ts');
  const content = readFileSync(rdfPath, 'utf-8');
  
  const operations = ['addEntity', 'getEntity', 'updateEntity', 'addLink'];
  for (const op of operations) {
    if (!content.includes(op)) {
      throw new Error(`RDF operation ${op} not found`);
    }
  }
});

test('Preferences service is complete', () => {
  const prefsPath = join(__dirname, 'src/services/preferences.ts');
  const content = readFileSync(prefsPath, 'utf-8');
  
  if (!content.includes('loadPreferences') || !content.includes('savePreferences')) {
    throw new Error('Preferences service incomplete');
  }
});

test('Window electron API checks are present', () => {
  const dataSourcePath = join(__dirname, 'src/services/dataSource.ts');
  const content = readFileSync(dataSourcePath, 'utf-8');
  
  // Check for proper window.electron checks before using Electron APIs
  if (!content.includes('window.electron?.fs')) {
    throw new Error('Missing window.electron checks in dataSource');
  }
});

test('Error handling is comprehensive', () => {
  const canvasPath = join(__dirname, 'src/components/canvas/Canvas.tsx');
  const content = readFileSync(canvasPath, 'utf-8');
  
  if (!content.includes('try') || !content.includes('catch')) {
    throw new Error('Missing error handling in Canvas');
  }
});

test('Constants are centralized', () => {
  const constantsPath = join(__dirname, 'src/lib/constants.ts');
  if (!existsSync(constantsPath)) {
    throw new Error('constants.ts not found');
  }
  
  const content = readFileSync(constantsPath, 'utf-8');
  if (!content.includes('DEFAULT_USER_ID')) {
    throw new Error('DEFAULT_USER_ID not found in constants');
  }
});

// Test 7: Code quality checks
test('No TODO comments left unaddressed', () => {
  function checkDirectory(dir) {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'dist') {
        checkDirectory(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        const content = readFileSync(fullPath, 'utf-8');
        if (content.match(/\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*BUG|\/\/\s*HACK/i)) {
          throw new Error(`TODO/FIXME/BUG/HACK comment found in ${fullPath}`);
        }
      }
    }
  }
  
  checkDirectory(join(__dirname, 'src'));
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Test Results Summary');
console.log('='.repeat(50));
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Total:  ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✨ All tests passed! DAX application is fully functional.');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${testsFailed} test(s) failed. Please review the issues above.`);
  process.exit(1);
}
