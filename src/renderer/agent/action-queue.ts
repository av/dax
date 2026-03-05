/**
 * Sequential action queue with cancellation and speed control.
 *
 * Actions represent animated agent operations in the 3D scene.
 * The queue processes one action at a time:
 *   1. Move avatar to target position
 *   2. Perform animation (pick up, carry, place, search scan, etc.)
 *   3. Execute the actual operation (IPC call)
 *   4. Log the result
 *
 * Speed multiplier affects animation duration:
 *   0.5x = slow, 1x = normal, 2x = fast, 5x = very fast, Infinity = instant (skip animations)
 */

/** Possible animation types for agent actions */
export type AgentAnimationType =
  | 'walk'
  | 'pickUp'
  | 'carry'
  | 'place'
  | 'searchScan'
  | 'idle'
  | 'think';

/** A single animated action in the queue */
export interface AnimatedAction {
  /** Unique action ID */
  id: string;
  /** Type of action */
  type: AgentAnimationType;
  /** Human-readable description */
  description: string;
  /** Target position in 3D space (x, z) */
  targetPosition?: { x: number; z: number };
  /** Target file/folder path */
  targetPath?: string;
  /** The actual operation to execute after animation */
  execute: () => Promise<ActionResult>;
  /** Animation duration in ms (before speed multiplier) */
  baseDurationMs: number;
  /** Callback when this action completes */
  onComplete?: (result: ActionResult) => void;
}

/** Result of an action execution */
export interface ActionResult {
  success: boolean;
  message: string;
  error?: string;
}

/** Speed presets */
export type SpeedPreset = 0.5 | 1 | 2 | 5 | typeof Infinity;

/** Callbacks the queue uses to interact with the avatar and scene */
export interface ActionQueueCallbacks {
  /** Move the avatar to a position in the scene */
  moveAvatarTo: (x: number, z: number, durationMs: number) => Promise<void>;
  /** Play an animation on the avatar */
  playAnimation: (type: AgentAnimationType, durationMs: number) => Promise<void>;
  /** Log an action result */
  logAction: (action: AnimatedAction, result: ActionResult) => Promise<void>;
}

/**
 * Action queue implementation.
 */
export class ActionQueue {
  private queue: AnimatedAction[] = [];
  private processing = false;
  private cancelled = false;
  private currentActionId: string | null = null;
  private _speed: SpeedPreset = 1;
  private callbacks: ActionQueueCallbacks;

  constructor(callbacks: ActionQueueCallbacks) {
    this.callbacks = callbacks;
  }

  /** Get the current speed multiplier */
  get speed(): SpeedPreset {
    return this._speed;
  }

  /** Set the animation speed */
  setSpeed(speed: SpeedPreset): void {
    this._speed = speed;
  }

  /** Get the number of queued actions */
  get length(): number {
    return this.queue.length;
  }

  /** Whether the queue is currently processing */
  get isProcessing(): boolean {
    return this.processing;
  }

  /** Get the current action being processed */
  get currentAction(): string | null {
    return this.currentActionId;
  }

  /**
   * Enqueue an action.
   * Starts processing if the queue was idle.
   */
  enqueue(action: AnimatedAction): void {
    this.queue.push(action);
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Cancel all queued actions and stop processing.
   */
  cancel(): void {
    this.cancelled = true;
    this.queue = [];
    this.currentActionId = null;
  }

  /**
   * Clear the queue without cancelling the current action.
   */
  clearPending(): void {
    this.queue = [];
  }

  /**
   * Reset the queue (after cancellation) so it can accept new actions.
   */
  reset(): void {
    this.cancelled = false;
    this.processing = false;
    this.queue = [];
    this.currentActionId = null;
  }

  /**
   * Process the queue sequentially.
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    this.cancelled = false;

    while (this.queue.length > 0 && !this.cancelled) {
      const action = this.queue.shift()!;
      this.currentActionId = action.id;

      try {
        await this.executeAction(action);
      } catch (err) {
        console.error('[action-queue] Action failed:', action.id, err);
        const result: ActionResult = {
          success: false,
          message: `Action failed: ${(err as Error).message}`,
          error: (err as Error).message,
        };
        action.onComplete?.(result);
        // Log failure but continue processing
        try {
          await this.callbacks.logAction(action, result);
        } catch {
          // Logging failure must not break the queue
        }
      }
    }

    this.processing = false;
    this.currentActionId = null;
  }

  /**
   * Execute a single action with animations.
   */
  private async executeAction(action: AnimatedAction): Promise<void> {
    if (this.cancelled) return;

    const isInstant = this._speed === Infinity;
    const speedFactor = isInstant ? 0 : 1 / (this._speed as number);

    // Step 1: Move avatar to target position (if applicable)
    if (action.targetPosition && !isInstant) {
      const moveDuration = 1000 * speedFactor;
      await this.callbacks.moveAvatarTo(
        action.targetPosition.x,
        action.targetPosition.z,
        moveDuration,
      );
    }

    if (this.cancelled) return;

    // Step 2: Play the action animation (unless instant)
    if (!isInstant && action.type !== 'idle') {
      const animDuration = action.baseDurationMs * speedFactor;
      await this.callbacks.playAnimation(action.type, animDuration);
    }

    if (this.cancelled) return;

    // Step 3: Execute the actual operation
    const result = await action.execute();

    // Step 4: Notify completion
    action.onComplete?.(result);

    // Step 5: Log the action
    try {
      await this.callbacks.logAction(action, result);
    } catch {
      // Logging failure must not block agent execution
    }
  }
}
