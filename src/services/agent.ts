import { AgentConfig, AgentTool } from '@/types';
import { getDatabaseInstance } from './database';
import { rdfService } from './rdf';

// Single-user desktop app - always use admin user
const USER_ID = 'admin';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentExecutionOptions {
  messages: AgentMessage[];
  tools?: AgentTool[];
  temperature?: number;
  maxTokens?: number;
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export class AgentExecutor {
  private config: AgentConfig & { id: string };

  constructor(config: AgentConfig & { id: string }) {
    this.config = config;
  }

  /**
   * Execute the agent with given messages
   */
  async execute(options: AgentExecutionOptions): Promise<AgentResponse> {
    const { messages, temperature, maxTokens } = options;

    // Build request body based on preset
    const requestBody: any = {
      messages: messages,
      temperature: temperature ?? this.config.temperature ?? 0.7,
      max_tokens: maxTokens ?? this.config.maxTokens ?? 2000,
    };

    // Add extra body fields from config
    if (this.config.extraBody) {
      Object.assign(requestBody, this.config.extraBody);
    }

    // Add tools if enabled
    const enabledTools = (this.config.tools || []).filter(t => t.enabled);
    if (enabledTools.length > 0) {
      requestBody.tools = this.formatTools(enabledTools);
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    // Add API key if present
    if (this.config.apiKey) {
      if (this.config.preset === 'openai' || this.config.preset === 'openrouter') {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      } else if (this.config.preset === 'anthropic') {
        headers['x-api-key'] = this.config.apiKey;
      } else {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
    }

    // Build URL with query params
    let url = this.config.apiUrl;
    if (this.config.queryParams && Object.keys(this.config.queryParams).length > 0) {
      const params = new URLSearchParams(this.config.queryParams);
      url = `${url}?${params.toString()}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // Parse response based on preset
      return this.parseResponse(data);
    } catch (error) {
      console.error('Agent execution error:', error);
      throw error;
    }
  }

  /**
   * Execute with system prompt
   */
  async chat(userMessage: string, conversationHistory: AgentMessage[] = []): Promise<AgentResponse> {
    const messages: AgentMessage[] = [];

    // Add system prompt if configured
    if (this.config.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    return this.execute({ messages });
  }

  /**
   * Format tools for the API
   */
  private formatTools(tools: AgentTool[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    }));
  }

  /**
   * Parse response from different API formats
   */
  private parseResponse(data: any): AgentResponse {
    // OpenAI/OpenRouter format
    if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      const choice = data.choices[0];
      const message = choice.message;

      return {
        content: message.content || '',
        toolCalls: message.tool_calls?.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}'),
        })),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    }

    // Anthropic format
    if (data.content && Array.isArray(data.content)) {
      const textContent = data.content.find((c: any) => c.type === 'text');
      return {
        content: textContent?.text || '',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
      };
    }

    // Fallback: assume content is directly in response
    return {
      content: data.content || data.response || JSON.stringify(data),
    };
  }

  /**
   * Execute tool call
   */
  async executeTool(toolCall: ToolCall): Promise<any> {
    switch (toolCall.name) {
      case 'read_canvas':
        return this.toolReadCanvas(toolCall.arguments);
      
      case 'write_canvas':
        return this.toolWriteCanvas(toolCall.arguments);
      
      case 'query_rdf':
        return this.toolQueryRDF(toolCall.arguments);
      
      default:
        throw new Error(`Unknown tool: ${toolCall.name}`);
    }
  }

  /**
   * Tool: Read canvas nodes
   */
  private async toolReadCanvas(args: any): Promise<any> {
    const db = getDatabaseInstance();
    const nodes = await db.getCanvasNodes(USER_ID);
    
    // Filter by type if specified
    if (args.type) {
      return nodes.filter(n => n.type === args.type);
    }
    
    return nodes;
  }

  /**
   * Tool: Write/modify canvas
   */
  private async toolWriteCanvas(args: any): Promise<any> {
    const db = getDatabaseInstance();
    
    if (args.action === 'add') {
      const node = {
        id: `node-${Date.now()}`,
        type: args.nodeType || 'data',
        title: args.title || 'New Node',
        x: args.x || Math.random() * 400 + 50,
        y: args.y || Math.random() * 300 + 50,
        width: 200,
        height: 150,
        data: args.data || {},
        config: args.config || {},
      };
      
      await db.saveCanvasNode(node, USER_ID);
      return { success: true, nodeId: node.id };
    }
    
    if (args.action === 'update' && args.nodeId) {
      const nodes = await db.getCanvasNodes(USER_ID);
      const node = nodes.find(n => n.id === args.nodeId);
      
      if (!node) {
        throw new Error(`Node ${args.nodeId} not found`);
      }
      
      const updatedNode = {
        ...node,
        ...args.updates,
      };
      
      await db.saveCanvasNode(updatedNode, USER_ID);
      return { success: true, nodeId: node.id };
    }
    
    if (args.action === 'delete' && args.nodeId) {
      await db.deleteCanvasNode(args.nodeId, USER_ID);
      return { success: true, nodeId: args.nodeId };
    }
    
    throw new Error('Invalid write_canvas action or missing parameters');
  }

  /**
   * Tool: Query RDF entities
   */
  private async toolQueryRDF(args: any): Promise<any> {
    if (args.type) {
      return await rdfService.queryByType(args.type);
    }
    
    if (args.attribute && args.value) {
      return await rdfService.queryByAttribute(args.attribute, args.value);
    }
    
    if (args.search) {
      return await rdfService.search(args.search);
    }
    
    return await rdfService.getAllEntities();
  }
}

/**
 * Agent Service - manages agent configurations and execution
 */
export class AgentService {
  /**
   * Get all configured agents
   */
  async getAgents(): Promise<(AgentConfig & { id: string })[]> {
    const db = getDatabaseInstance();
    return await db.getAgentConfigs(USER_ID);
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(id: string): Promise<(AgentConfig & { id: string }) | null> {
    const agents = await this.getAgents();
    return agents.find(a => a.id === id) || null;
  }

  /**
   * Create an executor for an agent
   */
  async createExecutor(agentId: string): Promise<AgentExecutor> {
    const agent = await this.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    return new AgentExecutor(agent);
  }

  /**
   * Quick execute: chat with an agent by ID
   */
  async chat(agentId: string, message: string, history: AgentMessage[] = []): Promise<AgentResponse> {
    const executor = await this.createExecutor(agentId);
    return await executor.chat(message, history);
  }
}

export const agentService = new AgentService();
