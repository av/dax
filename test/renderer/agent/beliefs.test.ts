/**
 * Tests for belief update logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock solid-js store for file-tree
vi.mock('solid-js/store', () => ({
  createStore: (initial: Record<string, unknown>) => {
    const state = { ...initial };
    const setState = (update: Record<string, unknown>) => Object.assign(state, update);
    return [state, setState];
  },
}));

vi.mock('solid-js', () => ({
  createSignal: (initial: unknown) => {
    let val = initial;
    return [() => val, (v: unknown) => { val = v; }];
  },
}));

import {
  updateBeliefs,
  createInitialBeliefs,
  serializeBeliefs,
  deserializeBeliefs,
} from '../../../src/renderer/agent/beliefs';
import { replaceTree, fileTree } from '../../../src/renderer/state/file-tree';
import type { FileEntry } from '../../../src/shared/file-types';

function makeEntry(
  path: string,
  type: 'file' | 'folder' = 'file',
  extra?: Partial<FileEntry>,
): FileEntry {
  const name = path.split('/').pop() ?? path;
  const ext = type === 'file' ? (name.split('.').pop() ?? '') : '';
  const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
  return {
    path,
    name,
    extension: ext,
    type,
    category: 'unknown',
    parentPath,
    ...extra,
  };
}

describe('Beliefs', () => {
  beforeEach(() => {
    replaceTree([]);
  });

  it('should create initial beliefs with zero counts', () => {
    const beliefs = createInitialBeliefs();
    expect(beliefs.file_count).toBe(0);
    expect(beliefs.folder_count).toBe(0);
    expect(beliefs.clutter_level).toBe(0);
    expect(beliefs.folder_depth).toBe(0);
    expect(beliefs.root_loose_files).toBe(0);
  });

  it('should update beliefs from empty workspace', () => {
    replaceTree([]);
    const beliefs = updateBeliefs('/tmp/workspace');
    expect(beliefs.file_count).toBe(0);
    expect(beliefs.folder_count).toBe(0);
    expect(beliefs.clutter_level).toBe(0);
    expect(beliefs.workspace_path).toBe('/tmp/workspace');
  });

  it('should count files and folders correctly', () => {
    replaceTree([
      makeEntry('file1.ts'),
      makeEntry('file2.ts'),
      makeEntry('src', 'folder'),
      makeEntry('src/index.ts'),
    ]);
    const beliefs = updateBeliefs('/tmp/workspace');
    expect(beliefs.file_count).toBe(3);
    expect(beliefs.folder_count).toBe(1);
  });

  it('should compute folder depth', () => {
    replaceTree([
      makeEntry('src', 'folder'),
      makeEntry('src/components', 'folder'),
      makeEntry('src/components/ui', 'folder'),
      makeEntry('src/components/ui/Button.tsx'),
    ]);
    const beliefs = updateBeliefs('/tmp/workspace');
    // path "src/components/ui/Button.tsx" has 3 slashes
    expect(beliefs.folder_depth).toBe(3);
  });

  it('should count root loose files', () => {
    replaceTree([
      makeEntry('readme.md'),
      makeEntry('config.ts'),
      makeEntry('package.json'),
    ]);
    const beliefs = updateBeliefs('/tmp/workspace');
    expect(beliefs.root_loose_files).toBe(3);
  });

  it('should compute low clutter for organized workspace', () => {
    replaceTree([
      makeEntry('src', 'folder'),
      makeEntry('src/a.ts'),
      makeEntry('src/b.ts'),
      makeEntry('lib', 'folder'),
      makeEntry('lib/c.ts'),
    ]);
    const beliefs = updateBeliefs('/tmp/workspace');
    expect(beliefs.clutter_level).toBeLessThan(0.5);
  });

  it('should compute high clutter for many loose root files', () => {
    const entries: FileEntry[] = [];
    for (let i = 0; i < 30; i++) {
      entries.push(makeEntry(`file${i}.txt`));
    }
    replaceTree(entries);
    const beliefs = updateBeliefs('/tmp/workspace');
    expect(beliefs.clutter_level).toBeGreaterThan(0.3);
  });

  it('should count categories', () => {
    replaceTree([
      makeEntry('a.ts', 'file', { category: 'code' }),
      makeEntry('b.ts', 'file', { category: 'code' }),
      makeEntry('img.png', 'file', { category: 'image' }),
    ]);
    const beliefs = updateBeliefs('/tmp/workspace');
    expect(beliefs.category_counts['code']).toBe(2);
    expect(beliefs.category_counts['image']).toBe(1);
  });

  it('should set last_updated timestamp', () => {
    const before = Date.now();
    const beliefs = updateBeliefs('/tmp/workspace');
    expect(beliefs.last_updated).toBeGreaterThanOrEqual(before);
  });

  it('should serialize and deserialize beliefs', () => {
    const beliefs = createInitialBeliefs();
    beliefs.file_count = 42;
    beliefs.workspace_path = '/test';

    const json = serializeBeliefs(beliefs);
    const restored = deserializeBeliefs(json);

    expect(restored.file_count).toBe(42);
    expect(restored.workspace_path).toBe('/test');
  });

  it('should return initial beliefs for invalid JSON', () => {
    const restored = deserializeBeliefs('invalid json');
    expect(restored.file_count).toBe(0);
  });
});
