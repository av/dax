/**
 * Intention planner: maps desire+beliefs to concrete plan steps.
 *
 * An intention represents a commitment to achieve a specific desire.
 * The planner generates a sequence of plan steps that the agent will execute.
 */
import type { AgentBeliefs } from './beliefs';

/** A single step in an execution plan */
export interface PlanStep {
  /** Step index (0-based) */
  index: number;
  /** Type of action to perform */
  actionType: 'move' | 'organize' | 'search' | 'create' | 'rename' | 'delete' | 'observe' | 'idle';
  /** Human-readable description */
  description: string;
  /** Target file/folder path (if applicable) */
  targetPath?: string;
  /** Destination path (for move/organize) */
  destinationPath?: string;
  /** Query string (for search) */
  query?: string;
  /** Estimated duration in ms */
  estimatedDurationMs: number;
}

/** A complete intention with an execution plan */
export interface Intention {
  /** Unique intention ID */
  id: string;
  /** The desire this intention fulfills */
  desireId: string;
  /** Human-readable description */
  description: string;
  /** The ordered list of plan steps */
  steps: PlanStep[];
  /** Current step being executed */
  currentStep: number;
  /** Whether the intention is complete */
  isComplete: boolean;
  /** Whether the intention was cancelled */
  isCancelled: boolean;
  /** When this intention was created */
  createdAt: number;
}

let intentionCounter = 0;

/**
 * Generate a unique intention ID.
 */
function generateIntentionId(): string {
  intentionCounter++;
  return `intention-${intentionCounter}-${Date.now()}`;
}

/**
 * Create an intention from a desire and current beliefs.
 *
 * The planner examines the beliefs to decide what steps are needed
 * to fulfill the desire. Different desires produce different plan types.
 */
export function createIntention(
  desireId: string,
  desireName: string,
  beliefs: AgentBeliefs,
): Intention {
  const id = generateIntentionId();
  let description: string;
  let steps: PlanStep[];

  switch (desireId) {
    case 'organize_workspace':
      ({ description, steps } = planOrganize(beliefs));
      break;
    case 'assist_user':
      ({ description, steps } = planAssistUser(beliefs));
      break;
    case 'learn_preferences':
      ({ description, steps } = planLearnPreferences(beliefs));
      break;
    default:
      description = `Execute desire: ${desireName}`;
      steps = [
        {
          index: 0,
          actionType: 'observe',
          description: 'Observe workspace state',
          estimatedDurationMs: 1000,
        },
      ];
  }

  return {
    id,
    desireId,
    description,
    steps,
    currentStep: 0,
    isComplete: false,
    isCancelled: false,
    createdAt: Date.now(),
  };
}

/**
 * Plan for organizing workspace.
 */
function planOrganize(beliefs: AgentBeliefs): { description: string; steps: PlanStep[] } {
  const steps: PlanStep[] = [];
  let stepIndex = 0;

  // Step 1: Observe current state
  steps.push({
    index: stepIndex++,
    actionType: 'observe',
    description: 'Scan workspace structure and identify clutter patterns',
    estimatedDurationMs: 2000,
  });

  // Step 2: If there are many loose root files, suggest organizing them
  if (beliefs.root_loose_files > 5) {
    steps.push({
      index: stepIndex++,
      actionType: 'organize',
      description: `Group ${beliefs.root_loose_files} loose root files into categorized folders`,
      targetPath: beliefs.workspace_path,
      estimatedDurationMs: 3000,
    });
  }

  // Step 3: Final observation to confirm improvement
  steps.push({
    index: stepIndex++,
    actionType: 'observe',
    description: 'Verify workspace organization improved',
    estimatedDurationMs: 1000,
  });

  return {
    description: `Organize workspace (clutter: ${(beliefs.clutter_level * 100).toFixed(0)}%)`,
    steps,
  };
}

/**
 * Plan for assisting the user.
 * This is mostly a standby plan — wait for user input.
 */
function planAssistUser(_beliefs: AgentBeliefs): { description: string; steps: PlanStep[] } {
  return {
    description: 'Stand by to assist user',
    steps: [
      {
        index: 0,
        actionType: 'idle',
        description: 'Wait for user commands or workspace changes',
        estimatedDurationMs: 500,
      },
    ],
  };
}

/**
 * Plan for learning user preferences.
 */
function planLearnPreferences(beliefs: AgentBeliefs): { description: string; steps: PlanStep[] } {
  return {
    description: 'Observe user patterns to learn preferences',
    steps: [
      {
        index: 0,
        actionType: 'observe',
        description: `Analyze workspace with ${beliefs.file_count} files for usage patterns`,
        estimatedDurationMs: 2000,
      },
    ],
  };
}

/**
 * Advance an intention to the next step.
 * Returns the next step, or null if the intention is complete.
 */
export function advanceIntention(intention: Intention): PlanStep | null {
  if (intention.isCancelled || intention.isComplete) return null;

  intention.currentStep++;
  if (intention.currentStep >= intention.steps.length) {
    intention.isComplete = true;
    return null;
  }

  return intention.steps[intention.currentStep];
}

/**
 * Get the current step of an intention.
 */
export function getCurrentStep(intention: Intention): PlanStep | null {
  if (intention.isComplete || intention.isCancelled) return null;
  if (intention.currentStep >= intention.steps.length) return null;
  return intention.steps[intention.currentStep];
}

/**
 * Cancel an intention.
 */
export function cancelIntention(intention: Intention): void {
  intention.isCancelled = true;
}

/**
 * Serialize an intention for DB storage.
 */
export function serializeIntention(intention: Intention): string {
  return JSON.stringify(intention);
}

/**
 * Deserialize an intention from JSON.
 */
export function deserializeIntention(json: string): Intention | null {
  try {
    return JSON.parse(json) as Intention;
  } catch {
    return null;
  }
}
