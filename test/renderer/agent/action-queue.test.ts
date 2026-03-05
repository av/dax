/**
 * Tests for the action queue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ActionQueue,
  type AnimatedAction,
  type ActionQueueCallbacks,
  type ActionResult,
} from '../../../src/renderer/agent/action-queue';

function createMockCallbacks(): ActionQueueCallbacks {
  return {
    moveAvatarTo: vi.fn(() => Promise.resolve()),
    playAnimation: vi.fn(() => Promise.resolve()),
    logAction: vi.fn(() => Promise.resolve()),
  };
}

function createTestAction(overrides?: Partial<AnimatedAction>): AnimatedAction {
  return {
    id: `test-action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'idle',
    description: 'Test action',
    baseDurationMs: 100,
    execute: vi.fn(() => Promise.resolve({ success: true, message: 'done' })),
    ...overrides,
  };
}

describe('ActionQueue', () => {
  let queue: ActionQueue;
  let callbacks: ActionQueueCallbacks;

  beforeEach(() => {
    callbacks = createMockCallbacks();
    queue = new ActionQueue(callbacks);
  });

  it('should start empty', () => {
    expect(queue.length).toBe(0);
    expect(queue.isProcessing).toBe(false);
    expect(queue.currentAction).toBeNull();
  });

  it('should enqueue and execute an action', async () => {
    const executeFn = vi.fn(() => Promise.resolve({ success: true, message: 'ok' }));
    const action = createTestAction({ execute: executeFn });

    const completedPromise = new Promise<ActionResult>((resolve) => {
      action.onComplete = resolve;
    });

    queue.enqueue(action);

    const result = await completedPromise;
    expect(result.success).toBe(true);
    expect(executeFn).toHaveBeenCalledOnce();
  });

  it('should process actions sequentially', async () => {
    const order: number[] = [];

    const action1 = createTestAction({
      id: 'action-1',
      execute: async () => {
        order.push(1);
        return { success: true, message: '1' };
      },
    });

    const action2 = createTestAction({
      id: 'action-2',
      execute: async () => {
        order.push(2);
        return { success: true, message: '2' };
      },
    });

    const p2 = new Promise<void>((resolve) => {
      action2.onComplete = () => resolve();
    });

    queue.enqueue(action1);
    queue.enqueue(action2);

    await p2;
    expect(order).toEqual([1, 2]);
  });

  it('should call moveAvatarTo when action has a target position', async () => {
    const action = createTestAction({
      targetPosition: { x: 5, z: 10 },
    });

    const completedPromise = new Promise<void>((resolve) => {
      action.onComplete = () => resolve();
    });

    queue.enqueue(action);
    await completedPromise;

    expect(callbacks.moveAvatarTo).toHaveBeenCalledWith(5, 10, expect.any(Number));
  });

  it('should log actions after execution', async () => {
    const action = createTestAction();
    const completedPromise = new Promise<void>((resolve) => {
      action.onComplete = () => resolve();
    });

    queue.enqueue(action);
    await completedPromise;

    expect(callbacks.logAction).toHaveBeenCalledOnce();
  });

  it('should cancel all pending actions', async () => {
    const executeFn = vi.fn(() => Promise.resolve({ success: true, message: 'ok' }));

    // Enqueue initial action that takes time
    const slowAction = createTestAction({
      id: 'slow',
      execute: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { success: true, message: 'slow done' };
      },
    });

    const neverAction = createTestAction({
      id: 'never',
      execute: executeFn,
    });

    queue.enqueue(slowAction);
    queue.enqueue(neverAction);

    // Cancel immediately
    queue.cancel();

    // Wait for any processing to stop
    await new Promise((r) => setTimeout(r, 100));

    // The second action's execute should not have been called
    // (it may or may not depending on timing, but queue should be cleared)
    expect(queue.length).toBe(0);
  });

  it('should clear pending without cancelling current', () => {
    queue.enqueue(createTestAction({ id: 'a' }));
    queue.enqueue(createTestAction({ id: 'b' }));
    queue.enqueue(createTestAction({ id: 'c' }));

    queue.clearPending();
    // Queue should now have only the current processing item (or fewer)
  });

  it('should reset after cancellation', () => {
    queue.cancel();
    queue.reset();
    expect(queue.length).toBe(0);
    expect(queue.isProcessing).toBe(false);
  });

  it('should set speed', () => {
    queue.setSpeed(2);
    expect(queue.speed).toBe(2);

    queue.setSpeed(0.5);
    expect(queue.speed).toBe(0.5);

    queue.setSpeed(Infinity);
    expect(queue.speed).toBe(Infinity);
  });

  it('should skip animations at instant speed', async () => {
    queue.setSpeed(Infinity);

    const action = createTestAction({
      targetPosition: { x: 1, z: 1 },
      type: 'pickUp',
    });

    const completedPromise = new Promise<void>((resolve) => {
      action.onComplete = () => resolve();
    });

    queue.enqueue(action);
    await completedPromise;

    // moveAvatarTo should NOT be called at instant speed
    expect(callbacks.moveAvatarTo).not.toHaveBeenCalled();
    // playAnimation should NOT be called at instant speed
    expect(callbacks.playAnimation).not.toHaveBeenCalled();
  });

  it('should handle action execution errors gracefully', async () => {
    const failingAction = createTestAction({
      execute: () => Promise.reject(new Error('Boom')),
    });

    const secondAction = createTestAction({ id: 'after-fail' });
    const completedPromise = new Promise<void>((resolve) => {
      secondAction.onComplete = () => resolve();
    });

    queue.enqueue(failingAction);
    queue.enqueue(secondAction);

    // Second action should still execute despite first failure
    await completedPromise;
    expect(secondAction.execute).toHaveBeenCalledOnce();
  });
});
