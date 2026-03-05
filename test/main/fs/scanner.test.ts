/**
 * Tests for the recursive directory scanner.
 * Verifies: depth limit, symlink handling, permission errors,
 * .gitignore patterns, file categorization, and FileEntry structure.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { scanDirectory } from '../../../src/main/fs/scanner';
import { createTestDir, cleanupTestDir, createSymlink } from '../../helpers/fs';
import { join } from 'path';
import { mkdir, chmod, writeFile } from 'fs/promises';

let testDir: string | null = null;

afterEach(async () => {
  if (testDir) {
    await cleanupTestDir(testDir);
    testDir = null;
  }
});

describe('scanDirectory', () => {
  it('scans files and folders recursively', async () => {
    testDir = await createTestDir({
      'src/index.ts': 'export {}',
      'src/utils/helpers.ts': 'export function help() {}',
      'README.md': '# Hello',
      'package.json': '{}',
    });

    const entries = await scanDirectory(testDir);

    // Should find: src/, src/utils/, src/index.ts, src/utils/helpers.ts, README.md, package.json = 6
    expect(entries.length).toBe(6);

    // Check for specific entries
    const paths = entries.map((e) => e.path);
    expect(paths).toContain('src');
    expect(paths).toContain('README.md');
    expect(paths).toContain('package.json');
    expect(paths).toContain(join('src', 'index.ts'));
    expect(paths).toContain(join('src', 'utils'));
    // helpers.ts is at depth 2 — within the default limit of 5
  });

  it('respects depth limit', async () => {
    testDir = await createTestDir({
      'a/b/c/d/e/f/deep.txt': 'deep',
    });

    // Scan with depth 2
    const entries = await scanDirectory(testDir, { maxDepth: 2 });
    const paths = entries.map((e) => e.path);

    // Should find a, a/b, a/b/c at most (depth 0=a, 1=b, 2=c)
    expect(paths).toContain('a');
    expect(paths).toContain(join('a', 'b'));
    expect(paths).toContain(join('a', 'b', 'c'));
    // Should NOT find deeper items
    expect(paths).not.toContain(join('a', 'b', 'c', 'd'));
    expect(paths).not.toContain(join('a', 'b', 'c', 'd', 'e'));
  });

  it('classifies file categories correctly', async () => {
    testDir = await createTestDir({
      'app.ts': 'code',
      'styles.css': 'code',
      'logo.png': '',
      'readme.md': 'docs',
      'data.json': '{}',
      'archive.zip': '',
      'song.mp3': '',
      'program.exe': '',
      'unknown.xyz': '',
    });

    const entries = await scanDirectory(testDir);
    const byName = new Map(entries.map((e) => [e.name, e]));

    expect(byName.get('app.ts')?.category).toBe('code');
    expect(byName.get('styles.css')?.category).toBe('code');
    expect(byName.get('logo.png')?.category).toBe('image');
    expect(byName.get('readme.md')?.category).toBe('document');
    expect(byName.get('data.json')?.category).toBe('data');
    expect(byName.get('archive.zip')?.category).toBe('archive');
    expect(byName.get('song.mp3')?.category).toBe('media');
    expect(byName.get('program.exe')?.category).toBe('binary');
    expect(byName.get('unknown.xyz')?.category).toBe('unknown');
  });

  it('builds correct FileEntry structure', async () => {
    testDir = await createTestDir({
      'src/index.ts': 'export {}',
    });

    const entries = await scanDirectory(testDir);
    const fileEntry = entries.find((e) => e.name === 'index.ts');
    const folderEntry = entries.find((e) => e.name === 'src');

    expect(fileEntry).toBeDefined();
    expect(fileEntry!.path).toBe(join('src', 'index.ts'));
    expect(fileEntry!.name).toBe('index.ts');
    expect(fileEntry!.extension).toBe('ts');
    expect(fileEntry!.type).toBe('file');
    expect(fileEntry!.category).toBe('code');
    expect(fileEntry!.parentPath).toBe('src');

    expect(folderEntry).toBeDefined();
    expect(folderEntry!.path).toBe('src');
    expect(folderEntry!.name).toBe('src');
    expect(folderEntry!.type).toBe('folder');
    expect(folderEntry!.parentPath).toBeNull();
  });

  it('skips node_modules and .git by default', async () => {
    testDir = await createTestDir({
      'node_modules/pkg/index.js': 'module.exports = {}',
      'src/app.ts': 'export {}',
    });
    // Also create .git directory
    await mkdir(join(testDir, '.git'), { recursive: true });
    await writeFile(join(testDir, '.git', 'config'), 'gitconfig');

    const entries = await scanDirectory(testDir);
    const paths = entries.map((e) => e.path);

    expect(paths).not.toContain('node_modules');
    expect(paths).toContain('src');
    expect(paths).toContain(join('src', 'app.ts'));
  });

  it('reads .gitignore patterns and skips matching entries', async () => {
    testDir = await createTestDir({
      '.gitignore': 'dist\nlogs\n',
      'dist/bundle.js': 'bundle',
      'logs/app.log': 'log data',
      'src/app.ts': 'export {}',
    });

    const entries = await scanDirectory(testDir);
    const paths = entries.map((e) => e.path);

    expect(paths).not.toContain('dist');
    expect(paths).not.toContain('logs');
    expect(paths).toContain('src');
  });

  it('skips symlinks gracefully', async () => {
    testDir = await createTestDir({
      'real.txt': 'real file',
      'subdir/another.txt': 'another file',
    });

    // Create a symlink
    await createSymlink(
      join(testDir, 'real.txt'),
      join(testDir, 'link.txt'),
    );

    const entries = await scanDirectory(testDir);
    const paths = entries.map((e) => e.path);

    expect(paths).toContain('real.txt');
    expect(paths).not.toContain('link.txt'); // Symlinks are skipped
  });

  it('handles permission errors gracefully', async () => {
    testDir = await createTestDir({
      'accessible/file.txt': 'ok',
      'restricted/secret.txt': 'nope',
    });

    // Remove read permissions from restricted directory
    await chmod(join(testDir, 'restricted'), 0o000);

    const entries = await scanDirectory(testDir);
    const paths = entries.map((e) => e.path);

    // accessible should work fine
    expect(paths).toContain('accessible');
    expect(paths).toContain(join('accessible', 'file.txt'));
    // restricted directory itself is listed, but its contents are skipped
    expect(paths).toContain('restricted');
    expect(paths).not.toContain(join('restricted', 'secret.txt'));

    // Restore permissions for cleanup
    await chmod(join(testDir, 'restricted'), 0o755);
  });

  it('returns empty array for empty directory', async () => {
    testDir = await createTestDir({});

    const entries = await scanDirectory(testDir);
    expect(entries).toEqual([]);
  });

  it('handles extra ignore patterns', async () => {
    testDir = await createTestDir({
      'src/app.ts': 'export {}',
      'coverage/lcov.info': 'coverage data',
    });

    const entries = await scanDirectory(testDir, { extraIgnore: ['coverage'] });
    const paths = entries.map((e) => e.path);

    expect(paths).toContain('src');
    expect(paths).not.toContain('coverage');
  });

  it('handles files with no extension', async () => {
    testDir = await createTestDir({
      'Makefile': 'all: build',
      'Dockerfile': 'FROM node',
    });

    const entries = await scanDirectory(testDir);
    const makefile = entries.find((e) => e.name === 'Makefile');

    expect(makefile).toBeDefined();
    expect(makefile!.extension).toBe('');
    expect(makefile!.category).toBe('unknown');
  });
});
