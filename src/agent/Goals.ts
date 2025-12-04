import type { Goal, GoalType, GoalStatus, GoalResult, Vector3 } from '@/types';
import { createGoal } from '@/types';
import { useAgentStore } from '@/ui/stores/agentStore';
import { useSceneStore } from '@/ui/stores/sceneStore';
import { v4 as uuidv4 } from 'uuid';

export interface GoalPriorityModifier {
  type: 'beacon' | 'boundary' | 'urgency' | 'user';
  value: number;
  reason: string;
}

export interface PrioritizedGoal extends Goal {
  effectivePriority: number;
  modifiers: GoalPriorityModifier[];
}

export interface GoalsConfig {
  maxConcurrentGoals: number;
  urgencyDecayRate: number;      // How much priority increases per second
  defaultAnalyzePriority: number;
  defaultOrganizePriority: number;
  attractBeaconBoost: number;    // Max priority boost from attract beacons
  repelBeaconPenalty: number;    // Max priority penalty from repel beacons
}

const DEFAULT_CONFIG: GoalsConfig = {
  maxConcurrentGoals: 3,
  urgencyDecayRate: 0.001,
  defaultAnalyzePriority: 50,
  defaultOrganizePriority: 40,
  attractBeaconBoost: 30,
  repelBeaconPenalty: -20,
};

/**
 * Goal management system for the agent
 * Handles goal creation, prioritization, and lifecycle
 */
export class GoalManager {
  private config: GoalsConfig;
  private beaconInfluences: Map<string, { 
    position: Vector3; 
    radius: number; 
    intensity: number;
    type: 'attract' | 'repel';
  }> = new Map();
  private boundaryRules: Map<string, { priority: number; action: string }> = new Map();

  constructor(config: Partial<GoalsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new goal
   */
  public createGoal(
    type: GoalType,
    title: string,
    description: string,
    targetObjectIds: string[],
    reasoning: string,
    priority?: number
  ): Goal {
    const defaultPriority = this.getDefaultPriority(type);
    const goal = createGoal(
      uuidv4(),
      type,
      title,
      description,
      targetObjectIds,
      reasoning
    );
    goal.priority = priority ?? defaultPriority;
    
    useAgentStore.getState().addGoal(goal);
    
    return goal;
  }

  /**
   * Get default priority for a goal type
   */
  private getDefaultPriority(type: GoalType): number {
    switch (type) {
      case 'analyze':
        return this.config.defaultAnalyzePriority;
      case 'organize':
        return this.config.defaultOrganizePriority;
      case 'review':
        return 60;
      case 'summarize':
        return 45;
      case 'execute':
        return 70;
      case 'custom':
        return 50;
      default:
        return 50;
    }
  }

  /**
   * Get the next goal to work on
   */
  public getNextGoal(): Goal | null {
    const prioritized = this.getPrioritizedGoals();
    const pending = prioritized.filter((g) => g.status === 'pending');
    
    if (pending.length === 0) return null;
    
    return pending[0] ?? null;
  }

  /**
   * Get all goals sorted by effective priority
   */
  public getPrioritizedGoals(): PrioritizedGoal[] {
    const store = useAgentStore.getState();
    const goals = Array.from(store.goals.values());
    
    return goals
      .map((goal) => this.calculateEffectivePriority(goal))
      .sort((a, b) => b.effectivePriority - a.effectivePriority);
  }

  /**
   * Calculate effective priority with modifiers
   */
  private calculateEffectivePriority(goal: Goal): PrioritizedGoal {
    const modifiers: GoalPriorityModifier[] = [];
    let effectivePriority = goal.priority;
    
    // Apply urgency decay (older goals get slightly higher priority)
    const ageSeconds = (Date.now() - goal.createdAt) / 1000;
    const urgencyBoost = ageSeconds * this.config.urgencyDecayRate;
    if (urgencyBoost > 0.1) {
      modifiers.push({
        type: 'urgency',
        value: urgencyBoost,
        reason: `Age: ${Math.floor(ageSeconds)}s`,
      });
      effectivePriority += urgencyBoost;
    }
    
    // Apply beacon influences
    for (const [beaconId, beacon] of this.beaconInfluences) {
      const objectPriority = this.calculateBeaconInfluence(goal, beacon);
      if (objectPriority !== 0) {
        modifiers.push({
          type: 'beacon',
          value: objectPriority,
          reason: `Beacon ${beaconId}`,
        });
        effectivePriority += objectPriority;
      }
    }
    
    // Apply boundary rules
    for (const [boundaryId, rule] of this.boundaryRules) {
      if (this.goalAffectedByBoundary(goal, boundaryId)) {
        modifiers.push({
          type: 'boundary',
          value: rule.priority,
          reason: `Boundary ${boundaryId}: ${rule.action}`,
        });
        effectivePriority += rule.priority;
      }
    }
    
    return {
      ...goal,
      effectivePriority: Math.max(0, Math.min(100, effectivePriority)),
      modifiers,
    };
  }

  /**
   * Calculate beacon influence on a goal
   */
  private calculateBeaconInfluence(
    goal: Goal,
    beacon: { position: Vector3; radius: number; intensity: number; type: 'attract' | 'repel' }
  ): number {
    // Get positions of target objects
    const sceneStore = useSceneStore.getState();
    let minDistance = Infinity;
    
    for (const objectId of goal.targetObjectIds) {
      const obj = sceneStore.getObject(objectId);
      if (obj) {
        const dx = obj.position.x - beacon.position.x;
        const dz = obj.position.z - beacon.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        minDistance = Math.min(minDistance, distance);
      }
    }
    
    // If no objects or all out of range, no influence
    if (minDistance > beacon.radius || minDistance === Infinity) {
      return 0;
    }
    
    // Calculate influence based on distance (closer = stronger)
    const normalizedDistance = minDistance / beacon.radius;
    const influence = (1 - normalizedDistance) * beacon.intensity;
    
    if (beacon.type === 'attract') {
      return influence * this.config.attractBeaconBoost;
    } else if (beacon.type === 'repel') {
      return influence * this.config.repelBeaconPenalty;
    }
    
    return 0;
  }

  /**
   * Check if goal is affected by a boundary
   */
  private goalAffectedByBoundary(_goal: Goal, _boundaryId: string): boolean {
    // This would check if goal's target objects are within the boundary
    // For now, return false as this requires object position lookups
    return false;
  }

  /**
   * Update a goal's status
   */
  public updateGoalStatus(goalId: string, status: GoalStatus): void {
    const store = useAgentStore.getState();
    const changes: Partial<Goal> = { status };
    
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      changes.completedAt = Date.now();
    }
    
    store.updateGoal(goalId, changes);
  }

  /**
   * Update a goal's progress
   */
  public updateGoalProgress(goalId: string, progress: number): void {
    useAgentStore.getState().updateGoal(goalId, {
      progress: Math.max(0, Math.min(100, progress)),
    });
  }

  /**
   * Complete a goal with result
   */
  public completeGoal(goalId: string, result: GoalResult): void {
    useAgentStore.getState().updateGoal(goalId, {
      status: result.success ? 'completed' : 'failed',
      progress: 100,
      result,
      completedAt: Date.now(),
    });
  }

  /**
   * Cancel a goal
   */
  public cancelGoal(goalId: string, reason: string = 'Cancelled by user'): void {
    useAgentStore.getState().updateGoal(goalId, {
      status: 'cancelled',
      result: {
        success: false,
        error: reason,
      },
      completedAt: Date.now(),
    });
  }

  /**
   * Set user-defined priority for a goal
   */
  public setGoalPriority(goalId: string, priority: number): void {
    useAgentStore.getState().updateGoal(goalId, {
      priority: Math.max(0, Math.min(100, priority)),
    });
  }

  /**
   * Register a beacon's influence
   */
  public registerBeaconInfluence(
    beaconId: string,
    position: Vector3,
    radius: number,
    intensity: number,
    type: 'attract' | 'repel'
  ): void {
    this.beaconInfluences.set(beaconId, { position, radius, intensity, type });
  }

  /**
   * Unregister a beacon
   */
  public unregisterBeacon(beaconId: string): void {
    this.beaconInfluences.delete(beaconId);
  }

  /**
   * Register a boundary rule
   */
  public registerBoundaryRule(boundaryId: string, priority: number, action: string): void {
    this.boundaryRules.set(boundaryId, { priority, action });
  }

  /**
   * Unregister a boundary
   */
  public unregisterBoundary(boundaryId: string): void {
    this.boundaryRules.delete(boundaryId);
  }

  /**
   * Get active goals count
   */
  public getActiveGoalsCount(): number {
    return useAgentStore.getState().getActiveGoals().length;
  }

  /**
   * Check if we can accept more goals
   */
  public canAcceptMoreGoals(): boolean {
    return this.getActiveGoalsCount() < this.config.maxConcurrentGoals;
  }

  /**
   * Get goals by type
   */
  public getGoalsByType(type: GoalType): Goal[] {
    const store = useAgentStore.getState();
    return Array.from(store.goals.values()).filter((g) => g.type === type);
  }

  /**
   * Get goals related to an object
   */
  public getGoalsForObject(objectId: string): Goal[] {
    const store = useAgentStore.getState();
    return Array.from(store.goals.values()).filter((g) =>
      g.targetObjectIds.includes(objectId)
    );
  }

  /**
   * Clear completed goals
   */
  public clearCompletedGoals(): void {
    const store = useAgentStore.getState();
    const completedGoals = Array.from(store.goals.values()).filter(
      (g) => g.status === 'completed' || g.status === 'cancelled' || g.status === 'failed'
    );
    
    completedGoals.forEach((goal) => {
      store.removeGoal(goal.id);
    });
  }

  /**
   * Get statistics about goals
   */
  public getStats(): {
    total: number;
    pending: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const store = useAgentStore.getState();
    const goals = Array.from(store.goals.values());
    
    return {
      total: goals.length,
      pending: goals.filter((g) => g.status === 'pending').length,
      active: goals.filter((g) => g.status === 'in_progress').length,
      completed: goals.filter((g) => g.status === 'completed').length,
      failed: goals.filter((g) => g.status === 'failed').length,
      cancelled: goals.filter((g) => g.status === 'cancelled').length,
    };
  }
}
