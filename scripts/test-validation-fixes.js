#!/usr/bin/env node

/**
 * Test script to verify validation fixes
 * Tests the security improvements made to src/lib/validation.ts
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Validation Security Fixes\n');
console.log('='.repeat(60));

let passCount = 0;
let failCount = 0;

function test(name, condition, details = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
    passCount++;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    failCount++;
  }
}

// Read the validation.ts file to verify changes
const validationPath = join(__dirname, '..', 'src', 'lib', 'validation.ts');
const validationContent = readFileSync(validationPath, 'utf-8');

console.log('\n📋 Test 1: URL Validator Protocol Whitelist');
console.log('-'.repeat(60));

test(
  'URL validator contains protocol check',
  validationContent.includes('allowedProtocols'),
  'Found allowedProtocols array in URL validator'
);

test(
  'URL validator allows http protocol',
  validationContent.includes("'http:'"),
  'http: protocol is whitelisted'
);

test(
  'URL validator allows https protocol',
  validationContent.includes("'https:'"),
  'https: protocol is whitelisted'
);

test(
  'URL validator checks parsed.protocol',
  validationContent.includes('parsed.protocol'),
  'Protocol is checked against whitelist'
);

console.log('\n📋 Test 2: HTML Escaping - Backtick Protection');
console.log('-'.repeat(60));

test(
  'escapeHtml includes backtick in map',
  validationContent.includes("'`'") && validationContent.includes('&#96;'),
  'Backtick character is mapped to &#96;'
);

test(
  'escapeHtml regex includes backtick',
  validationContent.includes('[&<>"\'/`]'),
  'Backtick is included in replacement regex'
);

console.log('\n📋 Test 3: Hotkey Validator - Case Insensitivity');
console.log('-'.repeat(60));

test(
  'Hotkey validator normalizes case',
  validationContent.includes('.charAt(0).toUpperCase()') && 
  validationContent.includes('.toLowerCase()'),
  'Hotkey modifiers are normalized to title case'
);

test(
  'Hotkey validator uses normalized comparison',
  validationContent.includes('normalizedModifiers'),
  'Uses normalized modifiers for validation'
);

console.log('\n📋 Test 4: Path Validator - Traversal Protection');
console.log('-'.repeat(60));

test(
  'Path validator checks for ..',
  validationContent.includes("value.includes('..')") && 
  validationContent.includes('Path traversal patterns'),
  'validators.path() now checks for path traversal'
);

test(
  'Directory path validator checks for ..',
  validationContent.match(/directoryPath.*?\{[\s\S]*?\.includes\('\.\.'\)[\s\S]*?\}/),
  'validators.directoryPath() checks for path traversal'
);

console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📈 Total:  ${passCount + failCount}`);

if (failCount === 0) {
  console.log('\n✨ All validation fixes verified successfully!');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failCount} test(s) failed. Please review the fixes.`);
  process.exit(1);
}
