/**
 * Agent BDI state signal store.
 * Reactive store for agent beliefs, desires, current intention, and status.
 */
import { createStore } from 'solid-js/store';
import type { AgentStatus } from '@shared/events';
import type { ChatMessageRow, InstructionRow, ActionLogRow } from '../db/types';

export interface AgentBDIState {
  /** Serialized beliefs object */
  beliefs: Record<string, unknown>;
  /** List of desires with priorities */
  desires: Array<{ id: string; name: string; priority: number; isActive: boolean }>;
  /** Current intention being executed, or null if idle */
  currentIntention: {
    id: string;
    desireId: string;
    description: string;
    currentStep: number;
    totalSteps: number;
  } | null;
  /** Agent status */
  status: AgentStatus;
  /** Agent avatar position in scene */
  positionX: number;
  positionZ: number;
  /** Chat message history */
  chatMessages: ChatMessageRow[];
  /** Learned instructions */
  instructions: InstructionRow[];
  /** Recent action log */
  actionLog: ActionLogRow[];
  /** Whether LLM is reachable */
  llmHealthy: boolean;
  /** Auto-learn proposal (shown after successful task) */
  autoLearnProposal: {
    trigger: string;
    action: string;
  } | null;
}

const [agentState, setAgentState] = createStore<AgentBDIState>({
  beliefs: {},
  desires: [],
  currentIntention: null,
  status: 'idle',
  positionX: 0,
  positionZ: 0,
  chatMessages: [],
  instructions: [],
  actionLog: [],
  llmHealthy: true,
  autoLearnProposal: null,
});

export { agentState, setAgentState };
