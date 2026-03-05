/**
 * Chat handler: processes user messages, routes to BDI engine or learning system.
 *
 * Responsibilities:
 * - Parse user input (detect teaching vs. command)
 * - Route teaching inputs to learning system
 * - Route commands to BDI engine via agent:prompt IPC
 * - Generate structured results for ChatPanel display
 */
import { setAgentState, agentState } from '../state/agent';
import { agentBridge } from './agent-bridge';
import { parseTeachingInput, createInstruction, matchInstruction } from './learning';
import type { ChatMessageRow, InstructionRow } from '../db/types';
import type { AgentResponse } from '@shared/ipc-api';
import { appConfig } from '../state/config';

export interface ChatResult {
  type: 'teaching_confirmed' | 'command_acknowledged' | 'command_result' | 'match_found' | 'error';
  message: string;
  instruction?: InstructionRow;
  agentResponse?: AgentResponse;
}

/**
 * Process a user chat message.
 *
 * Flow:
 * 1. Check if it's a teaching instruction → store and confirm
 * 2. Check if it matches a learned instruction → use as BDI context
 * 3. Otherwise → route to agent:prompt as a command
 */
export async function processUserMessage(
  message: string,
  sessionId: string | null,
): Promise<ChatResult> {
  // 1. Check for teaching pattern
  const teaching = parseTeachingInput(message);
  if (teaching) {
    return handleTeaching(teaching.trigger, teaching.action);
  }

  // 2. Check for instruction match
  const instructions = agentState.instructions;
  const match = matchInstruction(message, instructions);

  if (match) {
    // Update usage count
    const updated: InstructionRow = {
      ...match.instruction,
      usageCount: match.instruction.usageCount + 1,
      lastUsed: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await agentBridge.saveInstruction(updated);
      // Update local state
      setAgentState('instructions', (insts) =>
        insts.map((i) => (i.id === updated.id ? updated : i)),
      );
    } catch {
      // Non-critical: usage tracking failure
    }

    return {
      type: 'match_found',
      message: `I remember! ${match.instruction.actionDescription}`,
      instruction: updated,
    };
  }

  // 3. Route to agent prompt
  return handleCommand(message, sessionId);
}

/**
 * Handle a teaching instruction.
 */
async function handleTeaching(trigger: string, action: string): Promise<ChatResult> {
  const instruction = createInstruction(trigger, action, true);

  try {
    await agentBridge.saveInstruction(instruction);

    // Update local state
    setAgentState('instructions', (insts) => [...insts, instruction]);

    return {
      type: 'teaching_confirmed',
      message: `Got it! I'll ${action} when you say "${trigger}".`,
      instruction,
    };
  } catch (err) {
    return {
      type: 'error',
      message: `Failed to save instruction: ${(err as Error).message}`,
    };
  }
}

/**
 * Handle a general command by routing to the agent LLM.
 */
async function handleCommand(message: string, sessionId: string | null): Promise<ChatResult> {
  // Check LLM health first
  if (!agentState.llmHealthy) {
    return {
      type: 'error',
      message: 'LLM is currently unreachable. Autonomous actions are paused. Please check your AI configuration.',
    };
  }

  if (!sessionId) {
    try {
      sessionId = await agentBridge.createSession();
    } catch {
      return {
        type: 'error',
        message: 'Failed to create agent session.',
      };
    }
  }

  try {
    const context = {
      workspacePath: appConfig.workspacePath ?? undefined,
      beliefs: agentState.beliefs,
      fileCount: (agentState.beliefs.file_count as number) ?? 0,
    };

    const response = await agentBridge.prompt(sessionId, message, context);

    return {
      type: 'command_result',
      message: response.message,
      agentResponse: response,
    };
  } catch (err) {
    return {
      type: 'error',
      message: `Agent error: ${(err as Error).message}`,
    };
  }
}

/**
 * Create and save a chat message to DB and state.
 */
export async function addChatMessage(
  role: 'user' | 'agent',
  content: string,
  sessionId: string | null = null,
): Promise<ChatMessageRow> {
  const msg: ChatMessageRow = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
    sessionId,
  };

  // Update local state immediately
  setAgentState('chatMessages', (msgs) => [...msgs, msg]);

  // Persist to DB (fire-and-forget for responsiveness)
  try {
    await agentBridge.saveChatMessage(msg);
  } catch (err) {
    console.error('[chat-handler] Failed to save message:', err);
  }

  return msg;
}

/**
 * Load chat history from DB into state.
 */
export async function loadChatHistory(limit: number): Promise<void> {
  try {
    const messages = await agentBridge.getChatMessages(limit);
    setAgentState({ chatMessages: messages });
  } catch (err) {
    console.error('[chat-handler] Failed to load chat history:', err);
  }
}

/**
 * Load instructions from DB into state.
 */
export async function loadInstructions(): Promise<void> {
  try {
    const instructions = await agentBridge.getInstructions();
    setAgentState({ instructions });
  } catch (err) {
    console.error('[chat-handler] Failed to load instructions:', err);
  }
}

/**
 * Propose auto-learning after a successful task.
 */
export function proposeAutoLearn(trigger: string, action: string): void {
  setAgentState({ autoLearnProposal: { trigger, action } });
}

/**
 * Accept an auto-learn proposal and save it as an instruction.
 */
export async function acceptAutoLearn(): Promise<void> {
  const proposal = agentState.autoLearnProposal;
  if (!proposal) return;

  const instruction = createInstruction(proposal.trigger, proposal.action, false);

  try {
    await agentBridge.saveInstruction(instruction);
    setAgentState('instructions', (insts) => [...insts, instruction]);
    setAgentState({ autoLearnProposal: null });
  } catch (err) {
    console.error('[chat-handler] Failed to save auto-learn instruction:', err);
  }
}

/**
 * Dismiss an auto-learn proposal.
 */
export function dismissAutoLearn(): void {
  setAgentState({ autoLearnProposal: null });
}

/**
 * Check LLM health and update state. If unhealthy, agent should pause.
 */
export async function checkLLMHealth(): Promise<boolean> {
  try {
    const healthy = await agentBridge.health();
    setAgentState({ llmHealthy: healthy });
    return healthy;
  } catch {
    setAgentState({ llmHealthy: false });
    return false;
  }
}
