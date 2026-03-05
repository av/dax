/**
 * Tests for BDI engine core functionality.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the modules that BDI depends on
vi.mock('../../../src/renderer/engine/scene', () => ({
  getScene: () => null,
}));

vi.mock('../../../src/renderer/engine/mesh-factory', () => ({
  getMeshByPath: () => null,
}));

vi.mock('../../../src/renderer/agent/avatar', () => ({
  createAgentAvatar: vi.fn(() => ({
    root: { position: { x: 0, y: 0, z: 0 }, dispose: vi.fn() },
    body: { dispose: vi.fn() },
    head: { dispose: vi.fn() },
    indicator: { dispose: vi.fn() },
    status: 'idle',
    isMoving: false,
  })),
  getAgentAvatar: vi.fn(() => null),
  setAvatarStatus: vi.fn(),
  moveAvatarTo: vi.fn(() => Promise.resolve()),
  setAvatarPosition: vi.fn(),
  playAvatarAnimation: vi.fn(() => Promise.resolve()),
  disposeAgentAvatar: vi.fn(),
}));

vi.mock('../../../src/renderer/agent/agent-bridge', () => ({
  agentBridge: {
    createSession: vi.fn(() => Promise.resolve('test-session-1')),
    getState: vi.fn(() => Promise.resolve(null)),
    saveState: vi.fn(() => Promise.resolve()),
    logAction: vi.fn(() => Promise.resolve()),
    pruneLog: vi.fn(() => Promise.resolve(0)),
    prompt: vi.fn(() => Promise.resolve({ message: 'test', actions: [] })),
    health: vi.fn(() => Promise.resolve(true)),
    getInstructions: vi.fn(() => Promise.resolve([])),
    saveInstruction: vi.fn(() => Promise.resolve()),
    deleteInstruction: vi.fn(() => Promise.resolve()),
    getActionLog: vi.fn(() => Promise.resolve([])),
  },
  createCapabilityIPC: vi.fn(() => ({
    fsCreate: vi.fn(),
    fsMove: vi.fn(),
    fsRename: vi.fn(),
    fsDelete: vi.fn(),
    fsSearch: vi.fn(() => Promise.resolve([])),
  })),
}));

// Mock solid-js store
vi.mock('solid-js/store', () => ({
  createStore: (initial: Record<string, unknown>) => {
    const state = { ...initial };
    const setState = (update: Record<string, unknown>) => Object.assign(state, update);
    return [state, setState];
  },
}));

vi.mock('solid-js', () => ({
  createSignal: (initial: unknown) => {
    let val = initial;
    return [() => val, (v: unknown) => { val = v; }];
  },
}));

import {
  initBDIEngine,
  disposeBDIEngine,
  pauseAgent,
  resumeAgent,
  isAgentPaused,
  isAgentRunning,
  setLoopInterval,
  getActionQueue,
  getCurrentBeliefs,
} from '../../../src/renderer/agent/bdi';

describe('BDI Engine', () => {
  beforeEach(() => {
    disposeBDIEngine();
  });

  afterEach(() => {
    disposeBDIEngine();
  });

  it('should not be running before initialization', () => {
    expect(isAgentRunning()).toBe(false);
    expect(isAgentPaused()).toBe(false);
  });

  it('should initialize (no-op if no scene)', async () => {
    // getScene returns null in mock, so init will warn and return
    await initBDIEngine();
    // With no scene, it cannot fully initialize
    expect(isAgentRunning()).toBe(false);
  });

  it('should return initial beliefs before any cycle', () => {
    const beliefs = getCurrentBeliefs();
    expect(beliefs.file_count).toBe(0);
    expect(beliefs.folder_count).toBe(0);
    expect(beliefs.clutter_level).toBe(0);
  });

  it('should have no action queue before initialization', () => {
    expect(getActionQueue()).toBeNull();
  });

  it('should dispose cleanly when not running', () => {
    expect(() => disposeBDIEngine()).not.toThrow();
    expect(isAgentRunning()).toBe(false);
  });

  it('should allow setting loop interval', () => {
    // Should not throw even when not running
    expect(() => setLoopInterval(5000)).not.toThrow();
  });

  it('should not be paused initially', () => {
    expect(isAgentPaused()).toBe(false);
  });
});
