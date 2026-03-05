/**
 * Tests for the layout service module.
 *
 * Note: We cannot test the Web Worker directly in vitest (no Worker support),
 * so we test the buildLayoutGraph function and clearAllPins logic directly.
 * Worker-dependent functions (runFullLayout, runIncrementalLayout) require
 * integration testing with the actual browser environment.
 */
import { describe, it, expect } from 'vitest';
import { buildLayoutGraph, clearAllPins } from '../../../src/renderer/layout/layout-service';
import type { FileEntry } from '../../../src/shared/file-types';
import type { SceneObjectRow } from '../../../src/renderer/db/types';

function makeEntry(path: string, type: 'file' | 'folder', parentPath: string | null = null): FileEntry {
  return {
    path,
    name: path.split('/').pop() ?? path,
    extension: type === 'file' ? (path.split('.').pop() ?? '') : '',
    type,
    category: 'unknown',
    parentPath,
  };
}

function makeSceneObj(path: string, type: 'file' | 'folder', opts: { isPinned?: boolean; x?: number; z?: number } = {}): SceneObjectRow {
  return {
    id: `id-${path}`,
    path,
    parentPath: null,
    type,
    positionX: opts.x ?? 0,
    positionY: 0,
    positionZ: opts.z ?? 0,
    isPinned: opts.isPinned ?? false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('layout-service', () => {
  describe('buildLayoutGraph', () => {
    it('returns empty graph for no entries', () => {
      const result = buildLayoutGraph([], {});
      expect(result.nodes).toHaveLength(0);
      expect(result.links).toHaveLength(0);
    });

    it('builds nodes for each entry', () => {
      const entries: FileEntry[] = [
        makeEntry('src', 'folder'),
        makeEntry('src/app.ts', 'file', 'src'),
        makeEntry('README.md', 'file'),
      ];

      const result = buildLayoutGraph(entries, {});
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes.map((n) => n.id)).toEqual(['src', 'src/app.ts', 'README.md']);
    });

    it('creates parent-child links', () => {
      const entries: FileEntry[] = [
        makeEntry('src', 'folder'),
        makeEntry('src/app.ts', 'file', 'src'),
        makeEntry('src/index.ts', 'file', 'src'),
      ];

      const result = buildLayoutGraph(entries, {});
      expect(result.links).toHaveLength(2);
      expect(result.links[0]).toEqual({ source: 'src', target: 'src/app.ts' });
      expect(result.links[1]).toEqual({ source: 'src', target: 'src/index.ts' });
    });

    it('sets folders with larger radius', () => {
      const entries: FileEntry[] = [
        makeEntry('src', 'folder'),
        makeEntry('file.ts', 'file'),
      ];

      const result = buildLayoutGraph(entries, {});
      const folder = result.nodes.find((n) => n.id === 'src');
      const file = result.nodes.find((n) => n.id === 'file.ts');
      expect(folder!.radius).toBeGreaterThan(file!.radius);
    });

    it('uses existing positions from scene objects', () => {
      const entries: FileEntry[] = [
        makeEntry('file.ts', 'file'),
      ];
      const sceneObjects: Record<string, SceneObjectRow> = {
        'file.ts': makeSceneObj('file.ts', 'file', { x: 10, z: 20 }),
      };

      const result = buildLayoutGraph(entries, sceneObjects);
      const node = result.nodes[0];
      expect(node.x).toBe(10);
      expect(node.y).toBe(20); // positionZ maps to d3's y
    });

    it('respects pinned state from scene objects', () => {
      const entries: FileEntry[] = [
        makeEntry('file.ts', 'file'),
      ];
      const sceneObjects: Record<string, SceneObjectRow> = {
        'file.ts': makeSceneObj('file.ts', 'file', { isPinned: true }),
      };

      const result = buildLayoutGraph(entries, sceneObjects);
      expect(result.nodes[0].isPinned).toBe(true);
    });

    it('does not create links for root-level entries (no parentPath)', () => {
      const entries: FileEntry[] = [
        makeEntry('root-file.ts', 'file'),
        makeEntry('root-folder', 'folder'),
      ];

      const result = buildLayoutGraph(entries, {});
      expect(result.links).toHaveLength(0);
    });

    it('handles deep nesting correctly', () => {
      const entries: FileEntry[] = [
        makeEntry('a', 'folder'),
        makeEntry('a/b', 'folder', 'a'),
        makeEntry('a/b/c', 'folder', 'a/b'),
        makeEntry('a/b/c/file.ts', 'file', 'a/b/c'),
      ];

      const result = buildLayoutGraph(entries, {});
      expect(result.nodes).toHaveLength(4);
      expect(result.links).toHaveLength(3);
    });
  });

  describe('clearAllPins', () => {
    it('returns empty set when nothing is pinned', () => {
      const objects: Record<string, SceneObjectRow> = {
        'file.ts': makeSceneObj('file.ts', 'file'),
        'app.ts': makeSceneObj('app.ts', 'file'),
      };

      const unpinned = clearAllPins(objects);
      expect(unpinned.size).toBe(0);
    });

    it('returns set of pinned paths', () => {
      const objects: Record<string, SceneObjectRow> = {
        'file.ts': makeSceneObj('file.ts', 'file', { isPinned: true }),
        'app.ts': makeSceneObj('app.ts', 'file'),
        'src': makeSceneObj('src', 'folder', { isPinned: true }),
      };

      const unpinned = clearAllPins(objects);
      expect(unpinned.size).toBe(2);
      expect(unpinned.has('file.ts')).toBe(true);
      expect(unpinned.has('src')).toBe(true);
      expect(unpinned.has('app.ts')).toBe(false);
    });

    it('handles empty object map', () => {
      const unpinned = clearAllPins({});
      expect(unpinned.size).toBe(0);
    });
  });
});
