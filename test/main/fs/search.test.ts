/**
 * Tests for the content search module (main process).
 * Tests both searchByName (in-memory) and searchContent (child process).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { searchContent, searchByName } from '../../../src/main/fs/search';

describe('search', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `dax-search-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('searchByName', () => {
    const entries = [
      { path: 'src/app.ts', name: 'app.ts' },
      { path: 'src/index.ts', name: 'index.ts' },
      { path: 'src/utils/helpers.ts', name: 'helpers.ts' },
      { path: 'README.md', name: 'README.md' },
      { path: 'package.json', name: 'package.json' },
    ];

    it('returns empty for empty query', () => {
      const results = searchByName('', entries);
      expect(results).toEqual([]);
    });

    it('matches by filename (case-insensitive)', () => {
      const results = searchByName('APP', entries);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/app.ts');
      expect(results[0].name).toBe('app.ts');
    });

    it('matches by path', () => {
      const results = searchByName('utils', entries);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/utils/helpers.ts');
    });

    it('returns multiple matches', () => {
      const results = searchByName('.ts', entries);
      expect(results).toHaveLength(3);
    });

    it('limits results to MAX_RESULTS (100)', () => {
      const manyEntries = Array.from({ length: 200 }, (_, i) => ({
        path: `file${i}.ts`,
        name: `file${i}.ts`,
      }));
      const results = searchByName('file', manyEntries);
      expect(results).toHaveLength(100);
    });

    it('returns no results when nothing matches', () => {
      const results = searchByName('nonexistent-xyz', entries);
      expect(results).toHaveLength(0);
    });
  });

  describe('searchContent', () => {
    it('returns empty for empty query', async () => {
      const results = await searchContent('', testDir);
      expect(results).toEqual([]);
    });

    it('returns empty for empty dir', async () => {
      const results = await searchContent('hello', '');
      expect(results).toEqual([]);
    });

    it('finds content in files', async () => {
      // Create test files
      writeFileSync(join(testDir, 'hello.txt'), 'hello world\ngoodbye world\n');
      writeFileSync(join(testDir, 'other.txt'), 'no match here\n');

      const results = await searchContent('hello', testDir);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const match = results.find((r) => r.name === 'hello.txt');
      expect(match).toBeDefined();
      expect(match!.lineNumber).toBe(1);
      expect(match!.linePreview).toContain('hello world');
    });

    it('finds content in nested directories', async () => {
      const subDir = join(testDir, 'sub');
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, 'nested.txt'), 'test needle here\n');

      const results = await searchContent('needle', testDir);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const match = results.find((r) => r.name === 'nested.txt');
      expect(match).toBeDefined();
    });

    it('returns empty when no content matches', async () => {
      writeFileSync(join(testDir, 'file.txt'), 'no match here\n');
      const results = await searchContent('xyznonexistent123', testDir);
      expect(results).toHaveLength(0);
    });

    it('handles special characters in search query', async () => {
      writeFileSync(join(testDir, 'special.txt'), 'price is $100\n');
      const results = await searchContent('$100', testDir);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
