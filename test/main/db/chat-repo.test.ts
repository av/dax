import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB } from '../../helpers/db';
import { ChatRepo } from '../../../src/main/db/chat-repo';
import type { TursoDB } from '../../../src/main/db/index';
import type { ChatMessageRow } from '../../../src/renderer/db/types';

function makeMsg(overrides: Partial<ChatMessageRow> = {}): ChatMessageRow {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: 'Hello agent',
    timestamp: Date.now(),
    sessionId: null,
    ...overrides,
  };
}

describe('ChatRepo', () => {
  let db: TursoDB;
  let repo: ChatRepo;

  beforeEach(async () => {
    db = await createTestDB();
    repo = new ChatRepo(db);
  });

  describe('saveMessage / getMessages', () => {
    it('returns empty array for fresh DB', async () => {
      const msgs = await repo.getMessages(10);
      expect(msgs).toEqual([]);
    });

    it('saves and retrieves a message', async () => {
      const msg = makeMsg({ content: 'Tell me about my files', role: 'user' });
      await repo.saveMessage(msg);

      const msgs = await repo.getMessages(10);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe('Tell me about my files');
      expect(msgs[0].role).toBe('user');
    });

    it('returns messages in chronological order', async () => {
      await repo.saveMessage(makeMsg({ id: 'first', timestamp: 1000 }));
      await repo.saveMessage(makeMsg({ id: 'third', timestamp: 3000 }));
      await repo.saveMessage(makeMsg({ id: 'second', timestamp: 2000 }));

      const msgs = await repo.getMessages(10);
      expect(msgs.map((m) => m.id)).toEqual(['first', 'second', 'third']);
    });

    it('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.saveMessage(makeMsg({ timestamp: 1000 + i }));
      }

      const msgs = await repo.getMessages(2);
      expect(msgs).toHaveLength(2);
    });

    it('filters by beforeTimestamp', async () => {
      await repo.saveMessage(makeMsg({ id: 'old', timestamp: 1000 }));
      await repo.saveMessage(makeMsg({ id: 'mid', timestamp: 2000 }));
      await repo.saveMessage(makeMsg({ id: 'new', timestamp: 3000 }));

      const msgs = await repo.getMessages(10, 2500);
      expect(msgs).toHaveLength(2);
      expect(msgs.map((m) => m.id)).toEqual(['old', 'mid']);
    });
  });

  describe('getBySession', () => {
    it('returns messages for a specific session', async () => {
      await repo.saveMessage(makeMsg({ sessionId: 'sess-1', content: 'A' }));
      await repo.saveMessage(makeMsg({ sessionId: 'sess-2', content: 'B' }));
      await repo.saveMessage(makeMsg({ sessionId: 'sess-1', content: 'C' }));

      const msgs = await repo.getBySession('sess-1');
      expect(msgs).toHaveLength(2);
      expect(msgs.map((m) => m.content)).toEqual(['A', 'C']);
    });
  });

  describe('clearAll', () => {
    it('removes all messages', async () => {
      await repo.saveMessage(makeMsg());
      await repo.saveMessage(makeMsg());

      await repo.clearAll();
      const msgs = await repo.getMessages(10);
      expect(msgs).toEqual([]);
    });
  });
});
