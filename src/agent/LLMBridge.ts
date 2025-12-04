import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AgentConfig, ChatMessage } from '@/types';
import { useAgentStore } from '@/ui/stores/agentStore';
import { v4 as uuidv4 } from 'uuid';

// LLM Request and Response types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  finishReason: string;
}

export interface LLMChunk {
  requestId: string;
  content: string;
  index: number;
}

export interface LLMComplete {
  requestId: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMError {
  requestId: string;
  error: string;
}

// Context for agent LLM calls
export interface AgentContext {
  state: string;
  position: { x: number; y: number; z: number };
  focusedObject?: ObjectSummary;
  nearbyObjects: ObjectSummary[];
  activeGoals: GoalSummary[];
  recentMessages: ChatMessage[];
}

export interface ObjectSummary {
  id: string;
  type: string;
  name: string;
  distance: number;
  preview?: string;
}

export interface GoalSummary {
  id: string;
  type: string;
  title: string;
  status: string;
  progress: number;
}

/**
 * Bridge between the agent system and LLM API
 * Handles prompt construction, API calls, and response parsing
 */
export class LLMBridge {
  private config: AgentConfig;
  private conversationHistory: LLMMessage[] = [];
  private activeStreamListeners: Map<string, UnlistenFn[]> = new Map();
  private maxHistoryLength = 20;

  constructor(config: AgentConfig) {
    this.config = config;
    this.initializeSystemPrompt();
  }

  /**
   * Update the LLM configuration
   */
  public updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Initialize the system prompt
   */
  private initializeSystemPrompt(): void {
    const systemPrompt = this.buildSystemPrompt();
    this.conversationHistory = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];
  }

  /**
   * Build the system prompt for the agent
   */
  private buildSystemPrompt(): string {
    return `You are Dax, an AI assistant operating within a 3D spatial workspace.
You exist as a visible entity on a data plane where files and information are physical objects.

CAPABILITIES:
- You can see and approach objects on the plane
- You navigate the 3D space to interact with files
- You can analyze file contents and find relationships
- You set goals and work toward them autonomously
- You can execute code in a sandboxed environment (with user approval)

PERSONALITY:
- Helpful and proactive
- Clear and concise in communication
- Curious about the data and relationships
- Transparent about your intentions and limitations

RESPONSE GUIDELINES:
- Keep responses concise but informative
- Acknowledge user commands clearly
- Explain what you're doing when asked
- Suggest relevant actions when appropriate
- Ask for clarification when needed

You are currently in a desktop application. Users can drag files onto the plane, and you help organize and analyze them.`;
  }

  /**
   * Build context string for the current agent state
   */
  private buildContextString(context: AgentContext): string {
    let contextStr = `\n\nCURRENT STATE: ${context.state}`;
    contextStr += `\nPOSITION: (${context.position.x.toFixed(1)}, ${context.position.z.toFixed(1)})`;

    if (context.focusedObject) {
      contextStr += `\nFOCUSED ON: ${context.focusedObject.name} (${context.focusedObject.type})`;
      if (context.focusedObject.preview) {
        contextStr += `\nPREVIEW: ${context.focusedObject.preview.slice(0, 200)}...`;
      }
    }

    if (context.nearbyObjects.length > 0) {
      contextStr += '\n\nNEARBY OBJECTS:';
      for (const obj of context.nearbyObjects.slice(0, 5)) {
        contextStr += `\n- ${obj.name} (${obj.type}, ${obj.distance.toFixed(1)} units away)`;
      }
    }

    if (context.activeGoals.length > 0) {
      contextStr += '\n\nACTIVE GOALS:';
      for (const goal of context.activeGoals) {
        contextStr += `\n- [${goal.status}] ${goal.title} (${goal.progress}%)`;
      }
    }

    return contextStr;
  }

  /**
   * Send a message to the LLM and get a response
   */
  public async sendMessage(
    userMessage: string,
    context?: AgentContext,
    options?: LLMOptions
  ): Promise<string> {
    // Add context to the system message if provided
    let messages = [...this.conversationHistory];

    if (context) {
      const contextString = this.buildContextString(context);
      messages[0] = {
        role: 'system',
        content: this.buildSystemPrompt() + contextString,
      };
    }

    // Add the user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const response = await invoke<LLMResponse>('call_llm', {
        provider: this.config.llmProvider,
        model: this.config.llmModel,
        messages: messages,
        options: {
          temperature: options?.temperature ?? 0.7,
          maxTokens: options?.maxTokens ?? 1000,
          stream: false,
        },
      });

      // Add to conversation history
      this.addToHistory({
        role: 'user',
        content: userMessage,
      });
      this.addToHistory({
        role: 'assistant',
        content: response.content,
      });

      return response.content;
    } catch (error) {
      console.error('LLM call failed:', error);
      throw new Error(`Failed to get LLM response: ${error}`);
    }
  }

  /**
   * Stream a message response from the LLM
   */
  public async streamMessage(
    userMessage: string,
    context?: AgentContext,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const requestId = uuidv4();
    let fullResponse = '';
    const listeners: UnlistenFn[] = [];

    // Add context to the system message if provided
    let messages = [...this.conversationHistory];

    if (context) {
      const contextString = this.buildContextString(context);
      messages[0] = {
        role: 'system',
        content: this.buildSystemPrompt() + contextString,
      };
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    try {
      // Set up event listeners
      const chunkListener = await listen<LLMChunk>('llm-chunk', (event) => {
        if (event.payload.requestId === requestId) {
          fullResponse += event.payload.content;
          onChunk?.(event.payload.content);
        }
      });
      listeners.push(chunkListener);

      const completeListener = await listen<LLMComplete>('llm-complete', (event) => {
        if (event.payload.requestId === requestId) {
          // Add to conversation history
          this.addToHistory({
            role: 'user',
            content: userMessage,
          });
          this.addToHistory({
            role: 'assistant',
            content: fullResponse,
          });

          onComplete?.(fullResponse);
          this.cleanupListeners(requestId);
        }
      });
      listeners.push(completeListener);

      const errorListener = await listen<LLMError>('llm-error', (event) => {
        if (event.payload.requestId === requestId) {
          onError?.(event.payload.error);
          this.cleanupListeners(requestId);
        }
      });
      listeners.push(errorListener);

      this.activeStreamListeners.set(requestId, listeners);

      // Start the stream
      await invoke('stream_llm', {
        requestId,
        provider: this.config.llmProvider,
        model: this.config.llmModel,
        messages: messages,
        options: {
          temperature: 0.7,
          maxTokens: 1000,
          stream: true,
        },
      });
    } catch (error) {
      console.error('LLM stream failed:', error);
      this.cleanupListeners(requestId);
      onError?.(`Failed to start LLM stream: ${error}`);
    }
  }

  /**
   * Cancel an active stream
   */
  public async cancelStream(requestId: string): Promise<void> {
    try {
      await invoke('cancel_llm_stream', { requestId });
    } catch (error) {
      console.error('Failed to cancel stream:', error);
    }
    this.cleanupListeners(requestId);
  }

  /**
   * Clean up event listeners for a request
   */
  private cleanupListeners(requestId: string): void {
    const listeners = this.activeStreamListeners.get(requestId);
    if (listeners) {
      listeners.forEach((unlisten) => unlisten());
      this.activeStreamListeners.delete(requestId);
    }
  }

  /**
   * Add a message to conversation history
   */
  private addToHistory(message: LLMMessage): void {
    this.conversationHistory.push(message);

    // Trim history if too long (keep system message)
    while (this.conversationHistory.length > this.maxHistoryLength + 1) {
      this.conversationHistory.splice(1, 1);
    }
  }

  /**
   * Clear conversation history (keeps system prompt)
   */
  public clearHistory(): void {
    this.conversationHistory = [this.conversationHistory[0]!];
  }

  /**
   * Get the current conversation history
   */
  public getHistory(): LLMMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Generate agent thoughts based on context
   */
  public async generateThought(context: AgentContext): Promise<string> {
    const prompt = `Based on your current context, briefly describe what you're thinking or observing. Be concise (1-2 sentences).`;

    try {
      return await this.sendMessage(prompt, context, {
        temperature: 0.8,
        maxTokens: 100,
      });
    } catch {
      return 'Observing the workspace...';
    }
  }

  /**
   * Analyze an object and generate observations
   */
  public async analyzeObject(
    objectName: string,
    objectType: string,
    content: string,
    context: AgentContext
  ): Promise<{
    summary: string;
    observations: string[];
    suggestedActions: string[];
  }> {
    const prompt = `Analyze this ${objectType} file named "${objectName}":

CONTENT PREVIEW:
${content.slice(0, 2000)}

Provide:
1. A brief summary (1-2 sentences)
2. Key observations (up to 3)
3. Suggested actions I could take

Format your response as JSON:
{
  "summary": "...",
  "observations": ["...", "..."],
  "suggestedActions": ["...", "..."]
}`;

    try {
      const response = await this.sendMessage(prompt, context, {
        temperature: 0.5,
        maxTokens: 500,
      });

      // Parse JSON response
      const parsed = JSON.parse(response);
      return {
        summary: parsed.summary || 'Analysis complete.',
        observations: parsed.observations || [],
        suggestedActions: parsed.suggestedActions || [],
      };
    } catch (error) {
      console.error('Analysis failed:', error);
      return {
        summary: `Analyzed ${objectName}`,
        observations: ['Unable to generate detailed analysis'],
        suggestedActions: [],
      };
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    // Cancel all active streams
    for (const requestId of this.activeStreamListeners.keys()) {
      this.cancelStream(requestId);
    }
    this.conversationHistory = [];
  }
}

// Singleton instance for global access
let llmBridgeInstance: LLMBridge | null = null;

export function getLLMBridge(): LLMBridge {
  if (!llmBridgeInstance) {
    const agent = useAgentStore.getState().agent;
    const config = agent?.config ?? {
      llmProvider: 'openai' as const,
      llmModel: 'gpt-4',
      personality: {
        curiosity: 0.7,
        thoroughness: 0.6,
        proactivity: 0.5,
        verbosity: 0.4,
      },
      maxConcurrentGoals: 3,
      analysisDepth: 'medium' as const,
    };
    llmBridgeInstance = new LLMBridge(config);
  }
  return llmBridgeInstance;
}

export function resetLLMBridge(): void {
  if (llmBridgeInstance) {
    llmBridgeInstance.dispose();
    llmBridgeInstance = null;
  }
}
