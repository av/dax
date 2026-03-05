/**
 * Tests for the learning system: instruction matching, similarity, eviction.
 */
import { describe, it, expect } from 'vitest';

import {
  levenshteinDistance,
  stringSimilarity,
  substringContainment,
  matchInstruction,
  parseTeachingInput,
  createInstruction,
  getEvictionCandidates,
  getReviewCandidates,
  generateEmbedding,
} from '../../../src/renderer/agent/learning';
import type { InstructionRow } from '../../../src/renderer/db/types';

function makeInstruction(overrides: Partial<InstructionRow> = {}): InstructionRow {
  return {
    id: `inst-${Math.random().toString(36).slice(2, 8)}`,
    triggerPattern: 'organize my files',
    actionDescription: 'group files by type',
    embedding: null,
    confidence: 1.0,
    usageCount: 0,
    lastUsed: null,
    isUserCreated: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('Learning System', () => {
  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('returns correct distance for single edit', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });

    it('returns correct distance for different lengths', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('handles empty strings', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', '')).toBe(0);
    });
  });

  describe('stringSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(stringSimilarity('hello', 'hello')).toBe(1);
    });

    it('returns 1 for case-insensitive match', () => {
      expect(stringSimilarity('Hello', 'hello')).toBe(1);
    });

    it('returns 0 for completely different strings', () => {
      expect(stringSimilarity('abc', 'xyz')).toBe(0);
    });

    it('returns high similarity for close strings', () => {
      const sim = stringSimilarity('organize files', 'organize file');
      expect(sim).toBeGreaterThan(0.9);
    });

    it('handles empty strings', () => {
      expect(stringSimilarity('', 'hello')).toBe(0);
      expect(stringSimilarity('hello', '')).toBe(0);
    });

    it('handles whitespace trimming', () => {
      expect(stringSimilarity('  hello  ', 'hello')).toBe(1);
    });
  });

  describe('substringContainment', () => {
    it('matches when query is substring of trigger', () => {
      expect(substringContainment('organize my files', 'organize')).toBe(true);
    });

    it('matches when trigger is substring of query', () => {
      expect(substringContainment('organize', 'can you organize this')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(substringContainment('ORGANIZE', 'organize')).toBe(true);
    });

    it('returns false for non-matching strings', () => {
      expect(substringContainment('organize', 'search for files')).toBe(false);
    });
  });

  describe('matchInstruction', () => {
    it('matches exact trigger', () => {
      const instructions = [makeInstruction({ triggerPattern: 'organize my files' })];
      const result = matchInstruction('organize my files', instructions);
      expect(result).not.toBeNull();
      expect(result!.score).toBe(1);
    });

    it('matches similar trigger above threshold', () => {
      const instructions = [makeInstruction({ triggerPattern: 'organize my files' })];
      const result = matchInstruction('organize my file', instructions, 0.85);
      expect(result).not.toBeNull();
      expect(result!.score).toBeGreaterThanOrEqual(0.85);
    });

    it('returns null for no match below threshold', () => {
      const instructions = [makeInstruction({ triggerPattern: 'organize my files' })];
      const result = matchInstruction('search for documents', instructions, 0.85);
      expect(result).toBeNull();
    });

    it('falls back to substring containment', () => {
      const instructions = [makeInstruction({ triggerPattern: 'organize' })];
      const result = matchInstruction('can you organize the workspace', instructions, 0.85);
      expect(result).not.toBeNull();
    });

    it('returns best match among multiple instructions', () => {
      const instructions = [
        makeInstruction({ id: 'a', triggerPattern: 'organize files' }),
        makeInstruction({ id: 'b', triggerPattern: 'organize my files' }),
      ];
      const result = matchInstruction('organize my files', instructions, 0.85);
      expect(result).not.toBeNull();
      expect(result!.instruction.id).toBe('b');
    });

    it('returns null for empty instructions list', () => {
      const result = matchInstruction('anything', [], 0.85);
      expect(result).toBeNull();
    });
  });

  describe('parseTeachingInput', () => {
    it('parses "remember: when I say X, do Y"', () => {
      const result = parseTeachingInput('remember: when I say organize, do group files by type');
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe('organize');
      expect(result!.action).toBe('group files by type');
    });

    it('parses "when I say X, do Y"', () => {
      const result = parseTeachingInput('when I say clean up, do remove temporary files');
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe('clean up');
      expect(result!.action).toBe('remove temporary files');
    });

    it('parses with quotes around trigger', () => {
      const result = parseTeachingInput('when I say "sort it", do organize files alphabetically');
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe('sort it');
      expect(result!.action).toBe('organize files alphabetically');
    });

    it('parses "remember that: X means Y"', () => {
      const result = parseTeachingInput('remember that: cleanup means delete temp files');
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe('cleanup');
      expect(result!.action).toBe('delete temp files');
    });

    it('returns null for non-teaching input', () => {
      expect(parseTeachingInput('organize my files')).toBeNull();
      expect(parseTeachingInput('search for documents')).toBeNull();
      expect(parseTeachingInput('hello')).toBeNull();
    });
  });

  describe('createInstruction', () => {
    it('creates an instruction with correct fields', () => {
      const inst = createInstruction('organize', 'group files by type', true);
      expect(inst.id).toBeTruthy();
      expect(inst.triggerPattern).toBe('organize');
      expect(inst.actionDescription).toBe('group files by type');
      expect(inst.isUserCreated).toBe(true);
      expect(inst.usageCount).toBe(0);
      expect(inst.confidence).toBe(1.0);
      expect(inst.embedding).toBeNull();
      expect(inst.createdAt).toBeGreaterThan(0);
    });

    it('creates auto-learned instructions', () => {
      const inst = createInstruction('sort', 'sort alphabetically', false);
      expect(inst.isUserCreated).toBe(false);
    });
  });

  describe('getEvictionCandidates', () => {
    it('returns empty array when under limit', () => {
      const instructions = [makeInstruction()];
      const candidates = getEvictionCandidates(instructions, 10);
      expect(candidates).toEqual([]);
    });

    it('evicts least-used instructions when over limit', () => {
      const instructions = [
        makeInstruction({ id: 'a', usageCount: 0, lastUsed: null }),
        makeInstruction({ id: 'b', usageCount: 5, lastUsed: Date.now() }),
        makeInstruction({ id: 'c', usageCount: 1, lastUsed: Date.now() - 10000 }),
      ];
      const candidates = getEvictionCandidates(instructions, 2);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('a'); // lowest usage + null lastUsed
    });

    it('evicts multiple instructions when significantly over limit', () => {
      const instructions = Array.from({ length: 5 }, (_, i) =>
        makeInstruction({ id: `inst-${i}`, usageCount: i }),
      );
      const candidates = getEvictionCandidates(instructions, 3);
      expect(candidates).toHaveLength(2);
    });
  });

  describe('getReviewCandidates', () => {
    it('returns instructions with 0 usage older than review period', () => {
      const old = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago
      const instructions = [
        makeInstruction({ id: 'old-unused', usageCount: 0, createdAt: old }),
        makeInstruction({ id: 'old-used', usageCount: 3, createdAt: old }),
        makeInstruction({ id: 'new-unused', usageCount: 0, createdAt: Date.now() }),
      ];
      const candidates = getReviewCandidates(instructions);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('old-unused');
    });

    it('returns empty array when no candidates', () => {
      const instructions = [
        makeInstruction({ usageCount: 1 }),
        makeInstruction({ usageCount: 0, createdAt: Date.now() }),
      ];
      const candidates = getReviewCandidates(instructions);
      expect(candidates).toEqual([]);
    });
  });

  describe('generateEmbedding', () => {
    it('returns null (stub)', () => {
      expect(generateEmbedding('anything')).toBeNull();
    });
  });
});
