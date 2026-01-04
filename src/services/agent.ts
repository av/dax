import { AgentConfig, AgentTool } from '@/types';
import { getDatabaseInstance } from './database';
import { rdfService } from './rdf';
import { DEFAULT_USER_ID, DEFAULT_AGENT_TEMPERATURE, DEFAULT_AGENT_MAX_TOKENS } from '@/lib/constants';
import { generateUUID } from '@/lib/utils';

// Canvas node types - must match the CanvasNode type definition
const VALID_NODE_TYPES = ['data', 'agent', 'transform', 'output'] as const;

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
      temperature: temperature ?? this.config.temperature ?? DEFAULT_AGENT_TEMPERATURE,
      max_tokens: maxTokens ?? this.config.maxTokens ?? DEFAULT_AGENT_MAX_TOKENS,
    };

    // Add extra body fields from config (filtered for safety)
    if (this.config.extraBody) {
      // Only allow specific safe fields to be overridden
      const allowedFields = ['model', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop'];
      for (const [key, value] of Object.entries(this.config.extraBody)) {
        if (allowedFields.includes(key)) {
          requestBody[key] = value;
        }
      }
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
    return tools.map(tool => {
      const schema = this.getToolSchema(tool.name);
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: schema,
        },
      };
    });
  }

  /**
   * Get parameter schema for a specific tool
   */
  private getToolSchema(toolName: string): any {
    const schemas: Record<string, any> = {
      read_canvas: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: VALID_NODE_TYPES,
            description: 'Filter nodes by type (optional)',
          },
        },
      },
      write_canvas: {
        type: 'object',
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: ['add', 'update', 'delete'],
            description: 'The action to perform on canvas nodes',
          },
          nodeId: {
            type: 'string',
            description: 'Node ID for update or delete actions',
          },
          nodeType: {
            type: 'string',
            enum: VALID_NODE_TYPES,
            description: 'Type of node for add action',
          },
          title: {
            type: 'string',
            description: 'Title of the node',
          },
          x: {
            type: 'number',
            description: 'X coordinate for node position',
          },
          y: {
            type: 'number',
            description: 'Y coordinate for node position',
          },
          data: {
            type: 'object',
            description: 'Node data object',
          },
          config: {
            type: 'object',
            description: 'Node configuration object',
          },
          updates: {
            type: 'object',
            description: 'Updates to apply for update action',
          },
        },
      },
      query_rdf: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Query entities by type',
          },
          attribute: {
            type: 'string',
            description: 'Query entities by attribute key',
          },
          value: {
            description: 'Query entities by attribute value',
          },
          search: {
            type: 'string',
            description: 'Search entities by term',
          },
        },
      },
    };
    
    return schemas[toolName] || {
      type: 'object',
      properties: {},
    };
  }

  /**
   * Parse response from different API formats
   */
  private parseResponse(data: any): AgentResponse {
    // OpenAI/OpenRouter format
    if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      const choice = data.choices[0];
      const message = choice.message;

      let toolCalls: ToolCall[] | undefined;
      if (message.tool_calls) {
        toolCalls = message.tool_calls.map((tc: any) => {
          try {
            return {
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments || '{}'),
            };
          } catch (error) {
            console.error('Failed to parse tool call arguments:', error);
            return {
              id: tc.id,
              name: tc.function.name,
              arguments: {},
            };
          }
        });
      }

      return {
        content: message.content || '',
        toolCalls,
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
    const nodes = await db.getCanvasNodes(DEFAULT_USER_ID);
    
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
      // Validate node type
      const nodeType = args.nodeType || 'data';
      if (!VALID_NODE_TYPES.includes(nodeType)) {
        throw new Error(`Invalid node type: ${nodeType}. Must be one of: ${VALID_NODE_TYPES.join(', ')}`);
      }
      
      const node = {
        id: `node-${generateUUID()}`,
        type: nodeType,
        title: args.title || 'New Node',
        x: args.x || Math.random() * 400 + 50,
        y: args.y || Math.random() * 300 + 50,
        width: 200,
        height: 150,
        data: args.data || {},
        config: args.config || {},
      };
      
      await db.saveCanvasNode(node, DEFAULT_USER_ID);
      return { success: true, nodeId: node.id };
    }
    
    if (args.action === 'update' && args.nodeId) {
      const nodes = await db.getCanvasNodes(DEFAULT_USER_ID);
      const node = nodes.find(n => n.id === args.nodeId);
      
      if (!node) {
        throw new Error(`Node ${args.nodeId} not found`);
      }
      
      // Validate updates if node type is being changed
      if (args.updates?.type) {
        if (!VALID_NODE_TYPES.includes(args.updates.type)) {
          throw new Error(`Invalid node type: ${args.updates.type}. Must be one of: ${VALID_NODE_TYPES.join(', ')}`);
        }
      }
      
      const updatedNode = {
        ...node,
        ...args.updates,
      };
      
      await db.saveCanvasNode(updatedNode, DEFAULT_USER_ID);
      return { success: true, nodeId: node.id };
    }
    
    if (args.action === 'delete' && args.nodeId) {
      await db.deleteCanvasNode(args.nodeId, DEFAULT_USER_ID);
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
    return await db.getAgentConfigs(DEFAULT_USER_ID);
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
