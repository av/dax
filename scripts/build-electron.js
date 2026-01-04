#!/usr/bin/env node

/**
 * Build script for Electron main process
 * 
 * This script:
 * 1. Compiles main.js using TypeScript compiler
 * 2. Copies preload.cjs to dist/main
 * 3. Copies migrations directory to dist
 */

import { cpSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('Building Electron main process...');

// Step 1: Compile main.js
console.log('Compiling main.js...');
try {
  execSync('tsc src/main/main.js --outDir dist/main --allowJs --skipLibCheck', {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log('✓ Main process compiled');
} catch (error) {
  console.error('✗ Failed to compile main process');
  process.exit(1);
}

// Step 2: Copy preload.cjs
console.log('Copying preload.cjs...');
try {
  cpSync(
    join(rootDir, 'src/main/preload.cjs'),
    join(rootDir, 'dist/main/preload.cjs')
  );
  console.log('✓ Preload script copied');
} catch (error) {
  console.error('✗ Failed to copy preload script:', error.message);
  process.exit(1);
}

// Step 3: Copy migrations
console.log('Copying migrations...');
try {
  cpSync(
    join(rootDir, 'src/services/migrations'),
    join(rootDir, 'dist/migrations'),
    { recursive: true }
  );
  console.log('✓ Migrations copied');
} catch (error) {
  console.error('✗ Failed to copy migrations:', error.message);
  process.exit(1);
}

console.log('\n✓ Electron build completed successfully');
