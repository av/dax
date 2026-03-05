/**
 * Repository for agent-related tables:
 * - agent_state (singleton)
 * - agent_instructions
 * - agent_action_log
 */
import type { TursoDB } from './index';
import type { AgentStateRow, InstructionRow, ActionLogRow } from '../../renderer/db/types';

// ── DB row shapes (snake_case from SQLite) ──

interface AgentStateDbRow {
  id: string;
  beliefs: string;
  desires: string;
  current_intention: string | null;
  status: string;
  position_x: number;
  position_z: number;
  updated_at: number;
}

interface InstructionDbRow {
  id: string;
  trigger_pattern: string;
  action_description: string;
  embedding: ArrayBuffer | null;
  confidence: number;
  usage_count: number;
  last_used: number | null;
  is_user_created: number;
  created_at: number;
  updated_at: number;
}

interface ActionLogDbRow {
  id: string;
  timestamp: number;
  action_type: string;
  target_path: string | null;
  parameters: string | null;
  result: string;
  error_message: string | null;
  intention_id: string | null;
  instruction_id: string | null;
  belief_snapshot: string | null;
  duration_ms: number | null;
}

function toAgentState(r: AgentStateDbRow): AgentStateRow {
  return {
    id: r.id as 'singleton',
    beliefs: r.beliefs,
    desires: r.desires,
    currentIntention: r.current_intention,
    status: r.status as AgentStateRow['status'],
    positionX: r.position_x,
    positionZ: r.position_z,
    updatedAt: r.updated_at,
  };
}

function toInstruction(r: InstructionDbRow): InstructionRow {
  return {
    id: r.id,
    triggerPattern: r.trigger_pattern,
    actionDescription: r.action_description,
    embedding: r.embedding,
    confidence: r.confidence,
    usageCount: r.usage_count,
    lastUsed: r.last_used,
    isUserCreated: r.is_user_created === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toActionLog(r: ActionLogDbRow): ActionLogRow {
  return {
    id: r.id,
    timestamp: r.timestamp,
    actionType: r.action_type,
    targetPath: r.target_path,
    parameters: r.parameters,
    result: r.result as 'success' | 'failure',
    errorMessage: r.error_message,
    intentionId: r.intention_id,
    instructionId: r.instruction_id,
    beliefSnapshot: r.belief_snapshot,
    durationMs: r.duration_ms,
  };
}

export class AgentRepo {
  constructor(private db: TursoDB) {}

  // ── Agent State ──

  /** Get the singleton agent state. Returns null if not yet initialized. */
  async getState(): Promise<AgentStateRow | null> {
    const row = (await this.db
      .prepare("SELECT * FROM agent_state WHERE id = 'singleton'")
      .get()) as AgentStateDbRow | undefined;
    return row ? toAgentState(row) : null;
  }

  /** Save (upsert) the agent state. */
  async saveState(state: AgentStateRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO agent_state
         (id, beliefs, desires, current_intention, status, position_x, position_z, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'singleton',
        state.beliefs,
        state.desires,
        state.currentIntention,
        state.status,
        state.positionX,
        state.positionZ,
        state.updatedAt,
      );
  }

  // ── Agent Instructions ──

  /** Get all agent instructions. */
  async getInstructions(): Promise<InstructionRow[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM agent_instructions ORDER BY usage_count DESC')
      .all()) as InstructionDbRow[];
    return rows.map(toInstruction);
  }

  /** Get an instruction by ID. */
  async getInstruction(id: string): Promise<InstructionRow | null> {
    const row = (await this.db
      .prepare('SELECT * FROM agent_instructions WHERE id = ?')
      .get(id)) as InstructionDbRow | undefined;
    return row ? toInstruction(row) : null;
  }

  /** Save (upsert) an instruction. */
  async saveInstruction(inst: InstructionRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO agent_instructions
         (id, trigger_pattern, action_description, embedding, confidence,
          usage_count, last_used, is_user_created, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        inst.id,
        inst.triggerPattern,
        inst.actionDescription,
        inst.embedding,
        inst.confidence,
        inst.usageCount,
        inst.lastUsed,
        inst.isUserCreated ? 1 : 0,
        inst.createdAt,
        inst.updatedAt,
      );
  }

  /** Delete an instruction by ID. */
  async deleteInstruction(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM agent_instructions WHERE id = ?')
      .run(id);
  }

  // ── Agent Action Log ──

  /** Log an action. */
  async logAction(log: ActionLogRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO agent_action_log
         (id, timestamp, action_type, target_path, parameters, result,
          error_message, intention_id, instruction_id, belief_snapshot, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        log.id,
        log.timestamp,
        log.actionType,
        log.targetPath,
        log.parameters,
        log.result,
        log.errorMessage,
        log.intentionId,
        log.instructionId,
        log.beliefSnapshot,
        log.durationMs,
      );
  }

  /** Get action log entries with pagination. */
  async getActionLog(limit: number, offset: number): Promise<ActionLogRow[]> {
    const rows = (await this.db
      .prepare(
        'SELECT * FROM agent_action_log ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      )
      .all(limit, offset)) as ActionLogDbRow[];
    return rows.map(toActionLog);
  }

  /** Prune log entries older than the given threshold. Returns number of deleted rows. */
  async pruneLog(olderThanMs: number): Promise<number> {
    const threshold = Date.now() - olderThanMs;
    const countRow = (await this.db
      .prepare(
        'SELECT COUNT(*) as cnt FROM agent_action_log WHERE timestamp < ?',
      )
      .get(threshold)) as { cnt: number };

    await this.db
      .prepare('DELETE FROM agent_action_log WHERE timestamp < ?')
      .run(threshold);

    return countRow.cnt;
  }
}
