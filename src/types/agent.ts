import type { Vector3 } from './objects';

export type AgentState =
  | 'idle'
  | 'moving'
  | 'analyzing'
  | 'thinking'
  | 'executing'
  | 'waiting'
  | 'paused';

export interface AgentPersonality {
  curiosity: number;
  thoroughness: number;
  proactivity: number;
  verbosity: number;
}

export interface AgentConfig {
  llmProvider: 'openai' | 'anthropic' | 'local';
  llmModel: string;
  personality: AgentPersonality;
  maxConcurrentGoals: number;
  analysisDepth: 'shallow' | 'medium' | 'deep';
}

export interface Agent {
  id: string;
  name: string;
  state: AgentState;
  position: Vector3;
  targetPosition?: Vector3;
  focusedObjectId?: string;
  currentGoalId?: string;
  path: Vector3[];
  config: AgentConfig;
  createdAt: number;
  updatedAt: number;
}

export type GoalType =
  | 'analyze'
  | 'summarize'
  | 'organize'
  | 'review'
  | 'execute'
  | 'custom';

export type GoalStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface GoalResult {
  success: boolean;
  output?: string;
  artifacts?: string[];
  error?: string;
}

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  description: string;
  status: GoalStatus;
  priority: number;
  targetObjectIds: string[];
  progress: number;
  result?: GoalResult;
  reasoning: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export type AgentMessageType =
  | 'state_change'
  | 'goal_created'
  | 'goal_updated'
  | 'goal_completed'
  | 'thought'
  | 'observation'
  | 'question'
  | 'action'
  | 'error';

export interface AgentMessage {
  id: string;
  timestamp: number;
  type: AgentMessageType;
}

export interface StateChangeMessage extends AgentMessage {
  type: 'state_change';
  from: AgentState;
  to: AgentState;
  reason: string;
}

export interface GoalCreatedMessage extends AgentMessage {
  type: 'goal_created';
  goal: Goal;
  reasoning: string;
}

export interface ThoughtMessage extends AgentMessage {
  type: 'thought';
  content: string;
  context: {
    currentGoal?: string;
    focusedObject?: string;
    relevantObjects?: string[];
  };
}

export interface ObservationMessage extends AgentMessage {
  type: 'observation';
  content: string;
  objectIds: string[];
  importance: 'low' | 'medium' | 'high';
  suggestedAction?: string;
}

export interface QuestionMessage extends AgentMessage {
  type: 'question';
  content: string;
  options?: string[];
  requiresResponse: boolean;
  timeoutMs?: number;
}

export type AgentAction =
  | 'move'
  | 'analyze'
  | 'summarize'
  | 'organize'
  | 'execute_code'
  | 'create_snippet'
  | 'modify_file'
  | 'link_objects';

export interface ActionMessage extends AgentMessage {
  type: 'action';
  action: AgentAction;
  status: 'planned' | 'executing' | 'completed' | 'failed';
  target?: string;
  description: string;
}

export type AnyAgentMessage =
  | StateChangeMessage
  | GoalCreatedMessage
  | ThoughtMessage
  | ObservationMessage
  | QuestionMessage
  | ActionMessage;

// Chat message types for user-agent communication
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  relatedObjectIds?: string[];
  relatedGoalId?: string;
}

export interface UserCommand {
  id: string;
  timestamp: number;
  type: UserCommandType;
  payload: unknown;
}

export type UserCommandType =
  | 'chat'
  | 'direct'
  | 'pause'
  | 'resume'
  | 'cancel_goal'
  | 'set_priority'
  | 'focus_object'
  | 'approve'
  | 'deny';

export function createDefaultAgentConfig(): AgentConfig {
  return {
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    personality: {
      curiosity: 0.7,
      thoroughness: 0.6,
      proactivity: 0.5,
      verbosity: 0.4,
    },
    maxConcurrentGoals: 3,
    analysisDepth: 'medium',
  };
}

export function createAgent(id: string, name: string): Agent {
  const now = Date.now();
  return {
    id,
    name,
    state: 'idle',
    position: { x: 0, y: 0.5, z: 0 },
    path: [],
    config: createDefaultAgentConfig(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createGoal(
  id: string,
  type: GoalType,
  title: string,
  description: string,
  targetObjectIds: string[],
  reasoning: string
): Goal {
  const now = Date.now();
  return {
    id,
    type,
    title,
    description,
    status: 'pending',
    priority: 50,
    targetObjectIds,
    progress: 0,
    reasoning,
    createdAt: now,
    updatedAt: now,
  };
}
