/**
 * OpenCode SDK stub.
 *
 * The real @opencode-ai/sdk is not available as a dependency.
 * This module provides the same interface but returns simulated responses
 * so the agent system can be developed and tested end-to-end.
 *
 * The stub simulates an LLM that understands the DAX workspace context
 * and returns structured agent responses.
 */

/** Context passed alongside a prompt */
export interface AgentContext {
  workspacePath?: string;
  beliefs?: Record<string, unknown>;
  fileCount?: number;
  selectedFiles?: string[];
}

/** A structured response from the agent LLM */
export interface AgentResponse {
  message: string;
  actions?: AgentAction[];
  reasoning?: string;
}

/** An action the agent wants to perform */
export interface AgentAction {
  type: 'organize' | 'search' | 'create' | 'move' | 'rename' | 'delete' | 'none';
  targetPath?: string;
  destinationPath?: string;
  name?: string;
  query?: string;
  reason: string;
}

// ── Session management ──

let sessionCounter = 0;
const activeSessions = new Map<string, { createdAt: number; messageCount: number }>();

/**
 * Create a new agent session. Returns a session ID.
 */
export function createAgentSession(): string {
  sessionCounter++;
  const sessionId = `stub-session-${sessionCounter}-${Date.now()}`;
  activeSessions.set(sessionId, { createdAt: Date.now(), messageCount: 0 });
  return sessionId;
}

/**
 * Send a prompt to the agent and receive a simulated response.
 * The stub analyzes the message and context to produce reasonable responses.
 */
export async function sendPrompt(
  sessionId: string,
  message: string,
  context: AgentContext,
): Promise<AgentResponse> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }

  session.messageCount++;

  // Simulate a small delay like a real LLM call
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Analyze the message/context and produce a contextual response
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('organize') || lowerMsg.includes('clean')) {
    return {
      message: 'I can help organize your workspace. Let me group related files together.',
      actions: generateOrganizeActions(context),
      reasoning: 'The workspace could benefit from grouping files by type or project.',
    };
  }

  if (lowerMsg.includes('search') || lowerMsg.includes('find')) {
    return {
      message: 'I\'ll search through the workspace for you.',
      actions: [
        {
          type: 'search',
          query: extractSearchQuery(message),
          reason: 'Searching workspace based on user request.',
        },
      ],
      reasoning: 'User requested a search operation.',
    };
  }

  if (lowerMsg.includes('create') || lowerMsg.includes('new file')) {
    return {
      message: 'I\'ll create that for you.',
      actions: [
        {
          type: 'create',
          name: 'new-file.txt',
          targetPath: context.workspacePath ?? '.',
          reason: 'User requested file creation.',
        },
      ],
      reasoning: 'User requested file creation.',
    };
  }

  if (lowerMsg.includes('evaluate') || lowerMsg.includes('belief')) {
    const beliefs = context.beliefs ?? {};
    const fileCount = (beliefs.file_count as number) ?? context.fileCount ?? 0;
    const clutterLevel = (beliefs.clutter_level as number) ?? 0;

    if (clutterLevel > 0.7) {
      return {
        message: `Your workspace has ${fileCount} files and appears cluttered. I recommend organizing.`,
        actions: generateOrganizeActions(context),
        reasoning: `High clutter level (${clutterLevel}) suggests workspace needs organization.`,
      };
    }

    return {
      message: `Your workspace looks well-organized with ${fileCount} files. No action needed right now.`,
      actions: [{ type: 'none', reason: 'Workspace is adequately organized.' }],
      reasoning: 'Clutter level is acceptable.',
    };
  }

  // Default: no-action response
  return {
    message: 'I\'m here to help with your workspace. I can organize files, search, or create new ones.',
    actions: [{ type: 'none', reason: 'Awaiting specific instructions.' }],
    reasoning: 'No specific action identified from the message.',
  };
}

/**
 * Check if the OpenCode SDK stub is operational.
 */
export async function checkHealth(): Promise<boolean> {
  return true;
}

/**
 * Close an agent session.
 */
export function closeSession(sessionId: string): boolean {
  return activeSessions.delete(sessionId);
}

// ── Helpers ──

function generateOrganizeActions(context: AgentContext): AgentAction[] {
  const basePath = context.workspacePath ?? '.';
  return [
    {
      type: 'organize',
      targetPath: basePath,
      reason: 'Group related files into appropriate directories.',
    },
  ];
}

function extractSearchQuery(message: string): string {
  // Try to extract a meaningful search term from the message
  const patterns = [
    /(?:search|find|look for|locate)\s+['"]?(.+?)['"]?\s*$/i,
    /(?:search|find|look for|locate)\s+(.+?)(?:\s+in\s+|\s*$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (match?.[1]) return match[1].trim();
  }
  return message;
}
