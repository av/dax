/**
 * Desire definitions with priority scoring.
 *
 * Desires represent what the agent wants to achieve. Each desire has:
 * - A unique ID
 * - A name and description
 * - A priority (1-10, higher = more important)
 * - An activation function checking if the desire is relevant given current beliefs
 * - A priority scoring function that can adjust priority based on beliefs
 */
import type { AgentBeliefs } from './beliefs';

export interface Desire {
  /** Unique identifier for this desire */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this desire accomplishes */
  description: string;
  /** Base priority (1-10, higher = more urgent) */
  basePriority: number;
  /** Whether this desire is currently active (based on beliefs) */
  isActive: (beliefs: AgentBeliefs) => boolean;
  /** Compute effective priority given current beliefs */
  computePriority: (beliefs: AgentBeliefs) => number;
}

/**
 * Seed desire: organize_workspace
 * Active when clutter is above a threshold.
 * Priority increases with clutter level.
 */
export const organizeWorkspace: Desire = {
  id: 'organize_workspace',
  name: 'Organize Workspace',
  description: 'Group related files, reduce clutter, and improve workspace structure.',
  basePriority: 5,
  isActive: (beliefs) => beliefs.clutter_level > 0.4,
  computePriority: (beliefs) => {
    // Priority scales from 5 to 9 based on clutter
    return Math.min(5 + beliefs.clutter_level * 5, 9);
  },
};

/**
 * Seed desire: assist_user
 * Always active — the agent should always be ready to help.
 * Fixed high priority.
 */
export const assistUser: Desire = {
  id: 'assist_user',
  name: 'Assist User',
  description: 'Be responsive to user commands and requests.',
  basePriority: 8,
  isActive: () => true,
  computePriority: () => 8,
};

/**
 * Seed desire: learn_preferences
 * Active when the agent has seen enough activity.
 * Low priority — background task.
 */
export const learnPreferences: Desire = {
  id: 'learn_preferences',
  name: 'Learn Preferences',
  description: 'Observe user behavior patterns to improve future suggestions.',
  basePriority: 3,
  isActive: (beliefs) => beliefs.file_count > 10,
  computePriority: (beliefs) => {
    // Slightly higher priority with more files (more to learn from)
    return Math.min(3 + beliefs.file_count / 100, 5);
  },
};

/** The built-in set of seed desires */
export const SEED_DESIRES: Desire[] = [organizeWorkspace, assistUser, learnPreferences];

/**
 * Evaluate all desires against current beliefs.
 * Returns desires sorted by computed priority (highest first),
 * with their isActive status.
 */
export function evaluateDesires(
  beliefs: AgentBeliefs,
  desires: Desire[] = SEED_DESIRES,
): Array<{ id: string; name: string; priority: number; isActive: boolean }> {
  return desires
    .map((d) => ({
      id: d.id,
      name: d.name,
      priority: d.computePriority(beliefs),
      isActive: d.isActive(beliefs),
    }))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Select the highest-priority active desire.
 * Returns null if no desires are active.
 */
export function selectTopDesire(
  beliefs: AgentBeliefs,
  desires: Desire[] = SEED_DESIRES,
): { id: string; name: string; priority: number } | null {
  const evaluated = evaluateDesires(beliefs, desires);
  const active = evaluated.filter((d) => d.isActive);
  return active.length > 0 ? active[0] : null;
}
