/**
 * BDI Engine: belief update, desire evaluation, intention selection, plan execution loop.
 *
 * The BDI (Beliefs-Desires-Intentions) engine is the core decision-making loop
 * for the DAX agent. It runs on a configurable interval (default 30s) and:
 *
 * 1. updateBeliefs() — Refreshes beliefs from the file tree and scene state
 * 2. evaluateDesires() — Scores and activates desires based on beliefs
 * 3. selectIntention() — Picks the highest-priority active desire and plans steps
 * 4. executePlan() — Executes plan steps through the action queue
 *
 * The loop is pausable and its interval is configurable.
 */
import { setAgentState, agentState } from '../state/agent';
import { appConfig } from '../state/config';
import {
  updateBeliefs,
  serializeBeliefs,
  deserializeBeliefs,
  createInitialBeliefs,
  type AgentBeliefs,
} from './beliefs';
import { evaluateDesires, selectTopDesire, SEED_DESIRES } from './desires';
import {
  createIntention,
  getCurrentStep,
  advanceIntention,
  serializeIntention,
  deserializeIntention,
  type Intention,
} from './intentions';
import { findCapability, BUILT_IN_CAPABILITIES } from './capabilities';
import { ActionQueue, type AnimatedAction, type ActionResult, type ActionQueueCallbacks } from './action-queue';
import { agentBridge, createCapabilityIPC } from './agent-bridge';
import {
  createAgentAvatar,
  setAvatarStatus,
  moveAvatarTo as avatarMoveTo,
  setAvatarPosition,
  playAvatarAnimation,
  getAgentAvatar,
  disposeAgentAvatar,
} from './avatar';
import { getScene } from '../engine/scene';
import { getMeshByPath } from '../engine/mesh-factory';
import { BDI_LOOP_INTERVAL_MS, AGENT_WALK_SPEED, AGENT_LOG_RETENTION_DAYS } from '@shared/constants';
import type { AgentStatus } from '@shared/events';
import type { ActionLogRow } from '../db/types';
import { matchInstruction } from './learning';
import { proposeAutoLearn } from './chat-handler';

// ── Module state ──

let loopTimer: ReturnType<typeof setInterval> | null = null;
let currentIntention: Intention | null = null;
let actionQueue: ActionQueue | null = null;
let sessionId: string | null = null;
let beliefs: AgentBeliefs = createInitialBeliefs();
let isRunning = false;
let isPaused = false;
let isExecutingCycle = false;
let loopIntervalMs = BDI_LOOP_INTERVAL_MS;

// ── Action Queue Callbacks ──

function createQueueCallbacks(): ActionQueueCallbacks {
  return {
    moveAvatarTo: async (x: number, z: number, durationMs: number) => {
      const scene = getScene();
      if (!scene) return;
      await avatarMoveTo(x, z, durationMs, scene);
      setAgentState({ positionX: x, positionZ: z });
    },
    playAnimation: async (type, durationMs) => {
      const scene = getScene();
      if (!scene) return;
      await playAvatarAnimation(type, durationMs, scene);
    },
    logAction: async (action: AnimatedAction, result: ActionResult) => {
      const logEntry: ActionLogRow = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        actionType: action.type,
        targetPath: action.targetPath ?? null,
        parameters: null,
        result: result.success ? 'success' : 'failure',
        errorMessage: result.error ?? null,
        intentionId: currentIntention?.id ?? null,
        instructionId: null,
        beliefSnapshot: serializeBeliefs(beliefs),
        durationMs: action.baseDurationMs,
      };
      await agentBridge.logAction(logEntry);
      // Update action log in state for Agent Mind panel
      setAgentState('actionLog', (log) => [...log.slice(-19), logEntry]);

      // Propose auto-learn after successful task
      if (result.success && action.description) {
        proposeAutoLearn(action.description, `perform ${action.type} on ${action.targetPath ?? 'workspace'}`);
      }
    },
  };
}

// ── BDI Cycle ──

/**
 * Run one full BDI cycle:
 * 1. Update beliefs
 * 2. Evaluate desires
 * 3. Select intention
 * 4. Execute plan
 */
async function runBDICycle(): Promise<void> {
  if (isPaused || isExecutingCycle) return;

  // Check LLM health — if unhealthy, skip autonomous actions (degraded mode)
  if (!agentState.llmHealthy) {
    return;
  }

  isExecutingCycle = true;

  const scene = getScene();

  try {
    // 1. Update beliefs
    setStatus('thinking');
    const workspacePath = appConfig.workspacePath ?? '';
    beliefs = updateBeliefs(workspacePath);

    setAgentState({
      beliefs: beliefs as unknown as Record<string, unknown>,
    });

    // 2. Evaluate desires
    const evaluated = evaluateDesires(beliefs, SEED_DESIRES);
    setAgentState({
      desires: evaluated,
    });

    // 3. Select top desire and create intention
    const topDesire = selectTopDesire(beliefs, SEED_DESIRES);

    if (topDesire && topDesire.id !== 'assist_user') {
      // Create a new intention if we don't have one or the current one is done
      if (!currentIntention || currentIntention.isComplete || currentIntention.isCancelled) {
        currentIntention = createIntention(topDesire.id, topDesire.name, beliefs);

        setAgentState({
          currentIntention: {
            id: currentIntention.id,
            desireId: currentIntention.desireId,
            description: currentIntention.description,
            currentStep: currentIntention.currentStep,
            totalSteps: currentIntention.steps.length,
          },
        });
      }

      // 4. Execute plan steps
      await executePlanSteps();
    } else {
      // No actionable desire — go idle
      currentIntention = null;
      setAgentState({ currentIntention: null });
    }

    // Persist state to DB
    await persistState();

  } catch (err) {
    console.error('[bdi] Cycle error:', err);
  } finally {
    setStatus(isPaused ? 'paused' : 'idle');
    isExecutingCycle = false;
  }
}

/**
 * Execute plan steps from the current intention through the action queue.
 */
async function executePlanSteps(): Promise<void> {
  if (!currentIntention || !actionQueue) return;

  const step = getCurrentStep(currentIntention);
  if (!step) {
    currentIntention.isComplete = true;
    return;
  }

  const capabilityIPC = createCapabilityIPC();

  // For each step, create an animated action and enqueue it
  if (step.actionType === 'idle' || step.actionType === 'observe') {
    // These don't need animation or capability execution
    advanceIntention(currentIntention);
    setAgentState({
      currentIntention: currentIntention
        ? {
            id: currentIntention.id,
            desireId: currentIntention.desireId,
            description: currentIntention.description,
            currentStep: currentIntention.currentStep,
            totalSteps: currentIntention.steps.length,
          }
        : null,
    });
    return;
  }

  setStatus('acting');

  // Find target mesh position (if targeting a file)
  let targetPos: { x: number; z: number } | undefined;
  if (step.targetPath) {
    const mesh = getMeshByPath(step.targetPath);
    if (mesh) {
      targetPos = { x: mesh.position.x, z: mesh.position.z };
    }
  }

  // Find the appropriate capability
  const capability = findCapability(step, beliefs, BUILT_IN_CAPABILITIES);

  const animatedAction: AnimatedAction = {
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: step.actionType === 'search' ? 'searchScan' : step.actionType === 'organize' ? 'pickUp' : 'idle',
    description: step.description,
    targetPosition: targetPos,
    targetPath: step.targetPath,
    baseDurationMs: step.estimatedDurationMs,
    execute: async () => {
      if (capability) {
        const result = await capability.execute(step, beliefs, capabilityIPC);
        return {
          success: result.success,
          message: result.message,
          error: result.error,
        };
      }
      return { success: true, message: `Completed: ${step.description}` };
    },
  };

  actionQueue.enqueue(animatedAction);

  // Advance to next step
  advanceIntention(currentIntention);
}

/**
 * Persist agent state to the database.
 */
async function persistState(): Promise<void> {
  try {
    const avatar = getAgentAvatar();
    await agentBridge.saveState({
      id: 'singleton',
      beliefs: serializeBeliefs(beliefs),
      desires: JSON.stringify(evaluateDesires(beliefs)),
      currentIntention: currentIntention ? serializeIntention(currentIntention) : null,
      status: agentState.status as 'idle' | 'thinking' | 'acting' | 'paused',
      positionX: avatar?.root.position.x ?? agentState.positionX,
      positionZ: avatar?.root.position.z ?? agentState.positionZ,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('[bdi] Failed to persist state:', err);
  }
}

/**
 * Set the agent status in both the signal store and avatar.
 */
function setStatus(status: AgentStatus): void {
  setAgentState({ status });
  const scene = getScene();
  if (scene) {
    setAvatarStatus(status, scene);
  }
}

// ── Public API ──

/**
 * Initialize the BDI engine.
 * - Creates the agent avatar in the scene
 * - Creates the action queue
 * - Restores persisted state from DB
 * - Creates an LLM session (stub)
 * - Starts the BDI loop
 */
export async function initBDIEngine(): Promise<void> {
  if (isRunning) return;

  const scene = getScene();
  if (!scene) {
    console.warn('[bdi] Cannot init — no scene');
    return;
  }

  // Restore persisted state
  let restoredPosition: { x: number; z: number } | undefined;
  try {
    const savedState = await agentBridge.getState();
    if (savedState) {
      beliefs = deserializeBeliefs(savedState.beliefs);
      restoredPosition = { x: savedState.positionX, z: savedState.positionZ };

      if (savedState.currentIntention) {
        currentIntention = deserializeIntention(savedState.currentIntention);
      }

      setAgentState({
        beliefs: beliefs as unknown as Record<string, unknown>,
        status: savedState.status === 'paused' ? 'paused' : 'idle',
        positionX: savedState.positionX,
        positionZ: savedState.positionZ,
      });

      if (savedState.status === 'paused') {
        isPaused = true;
      }
    }
  } catch (err) {
    console.error('[bdi] Failed to restore state:', err);
  }

  // Create avatar
  createAgentAvatar(scene, restoredPosition);

  // Create action queue
  actionQueue = new ActionQueue(createQueueCallbacks());

  // Create LLM session
  try {
    sessionId = await agentBridge.createSession();
  } catch (err) {
    console.error('[bdi] Failed to create LLM session:', err);
  }

  // Prune old logs
  try {
    const retentionMs = AGENT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    await agentBridge.pruneLog(retentionMs);
  } catch {
    // Non-critical
  }

  // Load recent action log for Agent Mind panel
  try {
    const recentLog = await agentBridge.getActionLog(20, 0);
    setAgentState({ actionLog: recentLog });
  } catch {
    // Non-critical
  }

  isRunning = true;

  // Start the loop (unless paused)
  if (!isPaused) {
    startLoop();
  }
}

/**
 * Start the BDI loop timer.
 */
function startLoop(): void {
  if (loopTimer) return;

  // Run one cycle immediately
  runBDICycle();

  // Then run on interval
  loopTimer = setInterval(() => {
    runBDICycle();
  }, loopIntervalMs);
}

/**
 * Stop the BDI loop timer.
 */
function stopLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

/**
 * Pause the agent.
 * Stops the BDI loop, sets status to 'paused', avatar goes idle.
 */
export function pauseAgent(): void {
  isPaused = true;
  stopLoop();
  if (actionQueue) {
    actionQueue.cancel();
    actionQueue.reset();
  }
  setStatus('paused');
  persistState().catch(console.error);
}

/**
 * Resume the agent.
 * Restarts the BDI loop.
 */
export function resumeAgent(): void {
  isPaused = false;
  setStatus('idle');
  startLoop();
  persistState().catch(console.error);
}

/**
 * Check if the agent is paused.
 */
export function isAgentPaused(): boolean {
  return isPaused;
}

/**
 * Check if the agent is running (initialized).
 */
export function isAgentRunning(): boolean {
  return isRunning;
}

/**
 * Set the BDI loop interval.
 */
export function setLoopInterval(ms: number): void {
  loopIntervalMs = ms;
  if (loopTimer && !isPaused) {
    stopLoop();
    startLoop();
  }
}

/**
 * Get the action queue for external inspection or speed control.
 */
export function getActionQueue(): ActionQueue | null {
  return actionQueue;
}

/**
 * Get current beliefs.
 */
export function getCurrentBeliefs(): AgentBeliefs {
  return beliefs;
}

/**
 * Force a BDI cycle immediately (for testing or user-triggered updates).
 */
export async function forceBDICycle(): Promise<void> {
  await runBDICycle();
}

/**
 * Dispose the BDI engine and clean up resources.
 */
export function disposeBDIEngine(): void {
  stopLoop();
  if (actionQueue) {
    actionQueue.cancel();
  }
  disposeAgentAvatar();
  isRunning = false;
  isPaused = false;
  isExecutingCycle = false;
  currentIntention = null;
  actionQueue = null;
  sessionId = null;
  beliefs = createInitialBeliefs();
}
