/**
 * Learning system: instruction matching, string similarity, trigger resolution.
 *
 * Uses normalized Levenshtein distance for trigger matching.
 * Embedding-based matching is stubbed for future implementation.
 */
import { TRIGGER_MATCH_THRESHOLD, MAX_INSTRUCTIONS, INSTRUCTION_REVIEW_DAYS } from '@shared/constants';
import type { InstructionRow } from '../db/types';

/**
 * Compute the Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows for space efficiency
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Compute normalized string similarity (0-1, where 1 = identical).
 * Uses Levenshtein distance normalized by the max string length.
 */
export function stringSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();

  if (la === lb) return 1;
  if (la.length === 0 || lb.length === 0) return 0;

  const maxLen = Math.max(la.length, lb.length);
  const distance = levenshteinDistance(la, lb);
  return 1 - distance / maxLen;
}

/**
 * Check if query is a substring of trigger or vice versa (containment fallback).
 */
export function substringContainment(trigger: string, query: string): boolean {
  const lt = trigger.toLowerCase().trim();
  const lq = query.toLowerCase().trim();
  return lt.includes(lq) || lq.includes(lt);
}

/**
 * Match a user query against a set of instructions.
 * Returns the best matching instruction and its score, or null if none match.
 *
 * Matching strategy:
 * 1. Normalized Levenshtein similarity >= threshold
 * 2. Substring containment as fallback
 */
export function matchInstruction(
  query: string,
  instructions: InstructionRow[],
  threshold: number = TRIGGER_MATCH_THRESHOLD,
): { instruction: InstructionRow; score: number } | null {
  let bestMatch: InstructionRow | null = null;
  let bestScore = 0;

  for (const inst of instructions) {
    const similarity = stringSimilarity(inst.triggerPattern, query);

    if (similarity >= threshold && similarity > bestScore) {
      bestMatch = inst;
      bestScore = similarity;
    }
  }

  // If no Levenshtein match, try substring containment
  if (!bestMatch) {
    for (const inst of instructions) {
      if (substringContainment(inst.triggerPattern, query)) {
        // Substring match gets a fixed score of threshold (just at the boundary)
        bestMatch = inst;
        bestScore = threshold;
        break;
      }
    }
  }

  return bestMatch ? { instruction: bestMatch, score: bestScore } : null;
}

/**
 * Parse a teaching instruction from user input.
 * Detects patterns like:
 * - "remember: when I say X, do Y"
 * - "when I say X, do Y"
 * - "remember that when I say X, do Y"
 *
 * Returns { trigger, action } or null if no teaching pattern found.
 */
export function parseTeachingInput(input: string): { trigger: string; action: string } | null {
  const normalized = input.trim();

  // Pattern: "remember: when I say X, do Y"
  const rememberPattern = /^remember(?:\s+that)?:\s*when\s+I\s+say\s+["']?(.+?)["']?,?\s+do\s+["']?(.+?)["']?$/i;
  let match = rememberPattern.exec(normalized);
  if (match) {
    return { trigger: match[1].trim(), action: match[2].trim() };
  }

  // Pattern: "when I say X, do Y"
  const whenPattern = /^when\s+I\s+say\s+["']?(.+?)["']?,?\s+do\s+["']?(.+?)["']?$/i;
  match = whenPattern.exec(normalized);
  if (match) {
    return { trigger: match[1].trim(), action: match[2].trim() };
  }

  // Pattern: "remember: X means Y"
  const meansPattern = /^remember(?:\s+that)?:\s*["']?(.+?)["']?\s+means?\s+["']?(.+?)["']?$/i;
  match = meansPattern.exec(normalized);
  if (match) {
    return { trigger: match[1].trim(), action: match[2].trim() };
  }

  return null;
}

/**
 * Create a new instruction row from a teaching input.
 */
export function createInstruction(trigger: string, action: string, isUserCreated: boolean = true): InstructionRow {
  return {
    id: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    triggerPattern: trigger,
    actionDescription: action,
    embedding: null,
    confidence: 1.0,
    usageCount: 0,
    lastUsed: null,
    isUserCreated,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Check if instructions have exceeded the maximum count.
 * Returns instructions that should be evicted (LRU with usageCount=0).
 */
export function getEvictionCandidates(
  instructions: InstructionRow[],
  maxCount: number = MAX_INSTRUCTIONS,
): InstructionRow[] {
  if (instructions.length <= maxCount) return [];

  const excess = instructions.length - maxCount;

  // Sort by usageCount (ascending), then by lastUsed (ascending, null = oldest)
  const sorted = [...instructions].sort((a, b) => {
    if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
    const aLast = a.lastUsed ?? 0;
    const bLast = b.lastUsed ?? 0;
    return aLast - bLast;
  });

  return sorted.slice(0, excess);
}

/**
 * Get instructions flagged for review (0 usage after INSTRUCTION_REVIEW_DAYS days).
 */
export function getReviewCandidates(instructions: InstructionRow[]): InstructionRow[] {
  const cutoff = Date.now() - INSTRUCTION_REVIEW_DAYS * 24 * 60 * 60 * 1000;

  return instructions.filter(
    (inst) => inst.usageCount === 0 && inst.createdAt < cutoff,
  );
}

/**
 * Generate an embedding for a string.
 * Stub: returns null. Will be replaced with actual embedding API call.
 */
export function generateEmbedding(_text: string): ArrayBuffer | null {
  return null;
}
