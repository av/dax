/**
 * AgentCapability interface + built-in capabilities.
 *
 * Capabilities represent actions the agent can perform.
 * Each capability validates whether it can execute given the current beliefs,
 * and provides an execute function that performs the actual work through IPC.
 */
import type { AgentBeliefs } from './beliefs';
import type { PlanStep } from './intentions';

/** Result of a capability execution */
export interface CapabilityResult {
  success: boolean;
  message: string;
  error?: string;
  affectedPaths?: string[];
  durationMs: number;
}

/** Capability interface — each agent capability implements this */
export interface AgentCapability {
  /** Unique capability ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this capability does */
  description: string;
  /** Action types this capability handles */
  actionTypes: PlanStep['actionType'][];
  /** Check if this capability can execute the given step */
  canExecute: (step: PlanStep, beliefs: AgentBeliefs) => boolean;
  /** Execute the step. Returns a result. */
  execute: (
    step: PlanStep,
    beliefs: AgentBeliefs,
    ipc: CapabilityIPC,
  ) => Promise<CapabilityResult>;
}

/**
 * IPC interface that capabilities use to perform filesystem operations.
 * This decouples capabilities from the concrete IPC client implementation.
 */
export interface CapabilityIPC {
  fsCreate(filePath: string, type: 'file' | 'folder'): Promise<void>;
  fsMove(sourcePath: string, targetDir: string): Promise<void>;
  fsRename(oldPath: string, newPath: string): Promise<void>;
  fsDelete(filePath: string): Promise<void>;
  fsSearch(query: string, dir: string, mode: 'name' | 'content'): Promise<unknown[]>;
}

// ── Built-in capabilities ──

/**
 * Organize capability: groups files into folders.
 */
export const organizeCapability: AgentCapability = {
  id: 'organize',
  name: 'Organize Files',
  description: 'Group related files into folders to reduce workspace clutter.',
  actionTypes: ['organize'],
  canExecute: (step, beliefs) => {
    return step.actionType === 'organize' && beliefs.root_loose_files > 0;
  },
  execute: async (step, beliefs, ipc) => {
    const startTime = Date.now();
    try {
      // In a real implementation, this would analyze files and create
      // appropriate folder structures. For now, it's a structured stub
      // that demonstrates the capability pattern.
      const targetPath = step.targetPath ?? beliefs.workspace_path;

      return {
        success: true,
        message: `Analyzed workspace at ${targetPath} for organization opportunities.`,
        affectedPaths: [targetPath],
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        message: 'Failed to organize workspace.',
        error: (err as Error).message,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Search capability: searches for files by name or content.
 */
export const searchCapability: AgentCapability = {
  id: 'search',
  name: 'Search Files',
  description: 'Search for files by name or content.',
  actionTypes: ['search'],
  canExecute: (step) => {
    return step.actionType === 'search' && !!step.query;
  },
  execute: async (step, beliefs, ipc) => {
    const startTime = Date.now();
    try {
      const query = step.query ?? '';
      const results = await ipc.fsSearch(query, beliefs.workspace_path, 'name');
      return {
        success: true,
        message: `Found ${results.length} results for "${query}".`,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        message: `Search failed for "${step.query}".`,
        error: (err as Error).message,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Create capability: creates files or folders.
 */
export const createCapability: AgentCapability = {
  id: 'create',
  name: 'Create Files',
  description: 'Create new files or folders in the workspace.',
  actionTypes: ['create'],
  canExecute: (step) => {
    return step.actionType === 'create' && !!step.targetPath;
  },
  execute: async (step, _beliefs, ipc) => {
    const startTime = Date.now();
    try {
      const fullPath = step.targetPath!;
      await ipc.fsCreate(fullPath, 'file');
      return {
        success: true,
        message: `Created ${fullPath}.`,
        affectedPaths: [fullPath],
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to create ${step.targetPath}.`,
        error: (err as Error).message,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Move capability: moves files between directories.
 */
export const moveCapability: AgentCapability = {
  id: 'move',
  name: 'Move Files',
  description: 'Move files/folders to a different directory.',
  actionTypes: ['move'],
  canExecute: (step) => {
    return step.actionType === 'move' && !!step.targetPath && !!step.destinationPath;
  },
  execute: async (step, _beliefs, ipc) => {
    const startTime = Date.now();
    try {
      await ipc.fsMove(step.targetPath!, step.destinationPath!);
      return {
        success: true,
        message: `Moved ${step.targetPath} → ${step.destinationPath}.`,
        affectedPaths: [step.targetPath!, step.destinationPath!],
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to move ${step.targetPath}.`,
        error: (err as Error).message,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/** All built-in capabilities */
export const BUILT_IN_CAPABILITIES: AgentCapability[] = [
  organizeCapability,
  searchCapability,
  createCapability,
  moveCapability,
];

/**
 * Find a capability that can execute the given step.
 */
export function findCapability(
  step: PlanStep,
  beliefs: AgentBeliefs,
  capabilities: AgentCapability[] = BUILT_IN_CAPABILITIES,
): AgentCapability | null {
  for (const cap of capabilities) {
    if (cap.actionTypes.includes(step.actionType) && cap.canExecute(step, beliefs)) {
      return cap;
    }
  }
  return null;
}
