/**
 * Tests for desire evaluation logic.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateDesires,
  selectTopDesire,
  organizeWorkspace,
  assistUser,
  learnPreferences,
  SEED_DESIRES,
} from '../../../src/renderer/agent/desires';
import type { AgentBeliefs } from '../../../src/renderer/agent/beliefs';

function makeBeliefs(overrides?: Partial<AgentBeliefs>): AgentBeliefs {
  return {
    file_count: 20,
    folder_count: 5,
    folder_depth: 3,
    last_modified_files: [],
    clutter_level: 0.2,
    root_loose_files: 3,
    workspace_path: '/tmp/test',
    category_counts: {},
    last_updated: Date.now(),
    ...overrides,
  };
}

describe('Desires', () => {
  describe('organizeWorkspace', () => {
    it('should be inactive when clutter is low', () => {
      const beliefs = makeBeliefs({ clutter_level: 0.2 });
      expect(organizeWorkspace.isActive(beliefs)).toBe(false);
    });

    it('should be active when clutter exceeds threshold', () => {
      const beliefs = makeBeliefs({ clutter_level: 0.5 });
      expect(organizeWorkspace.isActive(beliefs)).toBe(true);
    });

    it('should increase priority with more clutter', () => {
      const lowClutter = makeBeliefs({ clutter_level: 0.4 });
      const highClutter = makeBeliefs({ clutter_level: 0.9 });
      expect(organizeWorkspace.computePriority(highClutter)).toBeGreaterThan(
        organizeWorkspace.computePriority(lowClutter),
      );
    });
  });

  describe('assistUser', () => {
    it('should always be active', () => {
      expect(assistUser.isActive(makeBeliefs())).toBe(true);
      expect(assistUser.isActive(makeBeliefs({ file_count: 0 }))).toBe(true);
    });

    it('should have fixed priority of 8', () => {
      expect(assistUser.computePriority(makeBeliefs())).toBe(8);
    });
  });

  describe('learnPreferences', () => {
    it('should be inactive with few files', () => {
      const beliefs = makeBeliefs({ file_count: 5 });
      expect(learnPreferences.isActive(beliefs)).toBe(false);
    });

    it('should be active with many files', () => {
      const beliefs = makeBeliefs({ file_count: 20 });
      expect(learnPreferences.isActive(beliefs)).toBe(true);
    });
  });

  describe('evaluateDesires', () => {
    it('should return all seed desires evaluated', () => {
      const beliefs = makeBeliefs();
      const result = evaluateDesires(beliefs);
      expect(result).toHaveLength(SEED_DESIRES.length);
    });

    it('should sort by priority (highest first)', () => {
      const beliefs = makeBeliefs({ clutter_level: 0.8 });
      const result = evaluateDesires(beliefs);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].priority).toBeGreaterThanOrEqual(result[i].priority);
      }
    });

    it('should mark inactive desires correctly', () => {
      const beliefs = makeBeliefs({ clutter_level: 0.1, file_count: 3 });
      const result = evaluateDesires(beliefs);
      const organize = result.find((d) => d.id === 'organize_workspace');
      expect(organize?.isActive).toBe(false);
    });
  });

  describe('selectTopDesire', () => {
    it('should select assist_user as top when clutter is low', () => {
      const beliefs = makeBeliefs({ clutter_level: 0.1 });
      const top = selectTopDesire(beliefs);
      expect(top).not.toBeNull();
      expect(top!.id).toBe('assist_user');
    });

    it('should select organize_workspace when clutter is very high', () => {
      const beliefs = makeBeliefs({ clutter_level: 0.95 });
      const top = selectTopDesire(beliefs);
      // organize priority = 5 + 0.95*5 = 9.75 (capped at 9), assist = 8
      expect(top).not.toBeNull();
      expect(top!.id).toBe('organize_workspace');
    });

    it('should return null if no desires are active', () => {
      // Custom desire set where nothing is active
      const neverActive = [{
        id: 'never',
        name: 'Never',
        description: 'Never active',
        basePriority: 1,
        isActive: () => false,
        computePriority: () => 1,
      }];
      const top = selectTopDesire(makeBeliefs(), neverActive);
      expect(top).toBeNull();
    });
  });
});
