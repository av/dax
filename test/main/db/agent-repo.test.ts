import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB } from '../../helpers/db';
import { AgentRepo } from '../../../src/main/db/agent-repo';
import type { TursoDB } from '../../../src/main/db/index';
import type { AgentStateRow, InstructionRow, ActionLogRow } from '../../../src/renderer/db/types';

function makeState(overrides: Partial<AgentStateRow> = {}): AgentStateRow {
  return {
    id: 'singleton',
    beliefs: '{}',
    desires: '[]',
    currentIntention: null,
    status: 'idle',
    positionX: 0,
    positionZ: 0,
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeInstruction(overrides: Partial<InstructionRow> = {}): InstructionRow {
  const now = Date.now();
  return {
    id: `inst-${Math.random().toString(36).slice(2)}`,
    triggerPattern: 'organize files',
    actionDescription: 'Move files into folders by type',
    embedding: null,
    confidence: 1.0,
    usageCount: 0,
    lastUsed: null,
    isUserCreated: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeLog(overrides: Partial<ActionLogRow> = {}): ActionLogRow {
  return {
    id: `log-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    actionType: 'file_move',
    targetPath: 'src/file.ts',
    parameters: null,
    result: 'success',
    errorMessage: null,
    intentionId: null,
    instructionId: null,
    beliefSnapshot: null,
    durationMs: 100,
    ...overrides,
  };
}

describe('AgentRepo', () => {
  let db: TursoDB;
  let repo: AgentRepo;

  beforeEach(async () => {
    db = await createTestDB();
    repo = new AgentRepo(db);
  });

  // ── Agent State ──

  describe('agent state', () => {
    it('returns null when no state exists', async () => {
      const state = await repo.getState();
      expect(state).toBeNull();
    });

    it('saves and retrieves agent state', async () => {
      const state = makeState({ beliefs: '{"files":10}', status: 'thinking' });
      await repo.saveState(state);

      const result = await repo.getState();
      expect(result).not.toBeNull();
      expect(result!.beliefs).toBe('{"files":10}');
      expect(result!.status).toBe('thinking');
      expect(result!.id).toBe('singleton');
    });

    it('updates existing state (upsert)', async () => {
      await repo.saveState(makeState({ status: 'idle' }));
      await repo.saveState(makeState({ status: 'acting', positionX: 5, positionZ: 10 }));

      const result = await repo.getState();
      expect(result!.status).toBe('acting');
      expect(result!.positionX).toBe(5);
      expect(result!.positionZ).toBe(10);
    });
  });

  // ── Instructions ──

  describe('instructions', () => {
    it('returns empty array when no instructions', async () => {
      const instructions = await repo.getInstructions();
      expect(instructions).toEqual([]);
    });

    it('saves and retrieves an instruction', async () => {
      const inst = makeInstruction({
        id: 'inst-1',
        triggerPattern: 'clean up',
        actionDescription: 'Remove temp files',
      });
      await repo.saveInstruction(inst);

      const all = await repo.getInstructions();
      expect(all).toHaveLength(1);
      expect(all[0].triggerPattern).toBe('clean up');
      expect(all[0].isUserCreated).toBe(true);
    });

    it('gets instruction by ID', async () => {
      const inst = makeInstruction({ id: 'specific-id' });
      await repo.saveInstruction(inst);

      const result = await repo.getInstruction('specific-id');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('specific-id');
    });

    it('returns null for missing instruction ID', async () => {
      const result = await repo.getInstruction('nonexistent');
      expect(result).toBeNull();
    });

    it('deletes instruction', async () => {
      const inst = makeInstruction({ id: 'to-delete' });
      await repo.saveInstruction(inst);

      await repo.deleteInstruction('to-delete');
      const result = await repo.getInstruction('to-delete');
      expect(result).toBeNull();
    });

    it('orders instructions by usage count descending', async () => {
      await repo.saveInstruction(makeInstruction({ id: 'low', usageCount: 1 }));
      await repo.saveInstruction(makeInstruction({ id: 'high', usageCount: 100 }));
      await repo.saveInstruction(makeInstruction({ id: 'mid', usageCount: 10 }));

      const all = await repo.getInstructions();
      expect(all.map((i) => i.id)).toEqual(['high', 'mid', 'low']);
    });
  });

  // ── Action Log ──

  describe('action log', () => {
    it('logs an action and retrieves it', async () => {
      const log = makeLog({ actionType: 'file_create', targetPath: 'newfile.ts' });
      await repo.logAction(log);

      const logs = await repo.getActionLog(10, 0);
      expect(logs).toHaveLength(1);
      expect(logs[0].actionType).toBe('file_create');
      expect(logs[0].result).toBe('success');
    });

    it('respects limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.logAction(makeLog({ timestamp: 1000 + i }));
      }

      const page1 = await repo.getActionLog(2, 0);
      expect(page1).toHaveLength(2);

      const page2 = await repo.getActionLog(2, 2);
      expect(page2).toHaveLength(2);
    });

    it('orders by timestamp descending', async () => {
      await repo.logAction(makeLog({ id: 'old', timestamp: 1000 }));
      await repo.logAction(makeLog({ id: 'new', timestamp: 3000 }));
      await repo.logAction(makeLog({ id: 'mid', timestamp: 2000 }));

      const logs = await repo.getActionLog(10, 0);
      expect(logs.map((l) => l.id)).toEqual(['new', 'mid', 'old']);
    });

    it('prunes old log entries', async () => {
      const now = Date.now();
      await repo.logAction(makeLog({ timestamp: now - 100_000 })); // old
      await repo.logAction(makeLog({ timestamp: now - 100_000 })); // old
      await repo.logAction(makeLog({ timestamp: now }));            // recent

      const pruned = await repo.pruneLog(50_000);
      expect(pruned).toBe(2);

      const remaining = await repo.getActionLog(10, 0);
      expect(remaining).toHaveLength(1);
    });
  });
});
