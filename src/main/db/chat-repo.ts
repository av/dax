/**
 * Repository for the chat_messages table.
 * Insert and query chat messages between user and agent.
 */
import type { TursoDB } from './index';
import type { ChatMessageRow } from '../../renderer/db/types';

interface ChatMessageDbRow {
  id: string;
  role: string;
  content: string;
  timestamp: number;
  session_id: string | null;
}

function toRow(r: ChatMessageDbRow): ChatMessageRow {
  return {
    id: r.id,
    role: r.role as 'user' | 'agent',
    content: r.content,
    timestamp: r.timestamp,
    sessionId: r.session_id,
  };
}

export class ChatRepo {
  constructor(private db: TursoDB) {}

  /** Save a chat message. */
  async saveMessage(msg: ChatMessageRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO chat_messages (id, role, content, timestamp, session_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(msg.id, msg.role, msg.content, msg.timestamp, msg.sessionId);
  }

  /**
   * Get chat messages with pagination.
   * @param limit - Max messages to return
   * @param beforeTimestamp - If provided, only return messages before this timestamp
   */
  async getMessages(
    limit: number,
    beforeTimestamp?: number,
  ): Promise<ChatMessageRow[]> {
    let rows: ChatMessageDbRow[];

    if (beforeTimestamp !== undefined) {
      rows = (await this.db
        .prepare(
          'SELECT * FROM chat_messages WHERE timestamp < ? ORDER BY timestamp DESC LIMIT ?',
        )
        .all(beforeTimestamp, limit)) as ChatMessageDbRow[];
    } else {
      rows = (await this.db
        .prepare(
          'SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT ?',
        )
        .all(limit)) as ChatMessageDbRow[];
    }

    // Return in chronological order (oldest first)
    return rows.map(toRow).reverse();
  }

  /** Get all messages for a specific session. */
  async getBySession(sessionId: string): Promise<ChatMessageRow[]> {
    const rows = (await this.db
      .prepare(
        'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC',
      )
      .all(sessionId)) as ChatMessageDbRow[];
    return rows.map(toRow);
  }

  /** Delete all messages. */
  async clearAll(): Promise<void> {
    await this.db.prepare('DELETE FROM chat_messages').run();
  }
}
