import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Agent, Goal, AgentState, AnyAgentMessage, Vector3, ChatMessage } from '@/types';
import { createAgent } from '@/types';

export interface AgentStoreState {
  agent: Agent | null;
  goals: Map<string, Goal>;
  messages: AnyAgentMessage[];
  chatHistory: ChatMessage[];
  isConnected: boolean;

  initializeAgent: (id: string, name: string) => void;
  updateAgentState: (state: AgentState) => void;
  updateAgentPosition: (position: Vector3) => void;
  setAgentTarget: (targetPosition: Vector3 | undefined, focusedObjectId?: string) => void;
  setAgentPath: (path: Vector3[]) => void;
  setCurrentGoal: (goalId: string | undefined) => void;

  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, changes: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  getGoal: (id: string) => Goal | undefined;
  getActiveGoals: () => Goal[];
  getPendingGoals: () => Goal[];

  addMessage: (message: AnyAgentMessage) => void;
  clearMessages: () => void;

  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;

  setConnected: (connected: boolean) => void;
  reset: () => void;
}

const MAX_MESSAGES = 100;
const MAX_CHAT_HISTORY = 200;

export const useAgentStore = create<AgentStoreState>()(
  subscribeWithSelector((set, get) => ({
    agent: null,
    goals: new Map(),
    messages: [],
    chatHistory: [],
    isConnected: false,

    initializeAgent: (id, name) => {
      set({ agent: createAgent(id, name) });
    },

    updateAgentState: (state) => {
      set((s) => {
        if (!s.agent) return s;
        return {
          agent: { ...s.agent, state, updatedAt: Date.now() },
        };
      });
    },

    updateAgentPosition: (position) => {
      set((s) => {
        if (!s.agent) return s;
        return {
          agent: { ...s.agent, position, updatedAt: Date.now() },
        };
      });
    },

    setAgentTarget: (targetPosition, focusedObjectId) => {
      set((s) => {
        if (!s.agent) return s;
        return {
          agent: {
            ...s.agent,
            targetPosition,
            focusedObjectId,
            updatedAt: Date.now(),
          },
        };
      });
    },

    setAgentPath: (path) => {
      set((s) => {
        if (!s.agent) return s;
        return {
          agent: { ...s.agent, path, updatedAt: Date.now() },
        };
      });
    },

    setCurrentGoal: (goalId) => {
      set((s) => {
        if (!s.agent) return s;
        return {
          agent: { ...s.agent, currentGoalId: goalId, updatedAt: Date.now() },
        };
      });
    },

    addGoal: (goal) => {
      set((s) => {
        const newGoals = new Map(s.goals);
        newGoals.set(goal.id, goal);
        return { goals: newGoals };
      });
    },

    updateGoal: (id, changes) => {
      set((s) => {
        const existing = s.goals.get(id);
        if (!existing) return s;

        const newGoals = new Map(s.goals);
        newGoals.set(id, { ...existing, ...changes, updatedAt: Date.now() });
        return { goals: newGoals };
      });
    },

    removeGoal: (id) => {
      set((s) => {
        const newGoals = new Map(s.goals);
        newGoals.delete(id);
        return { goals: newGoals };
      });
    },

    getGoal: (id) => get().goals.get(id),

    getActiveGoals: () => {
      const goals = Array.from(get().goals.values());
      return goals.filter((g) => g.status === 'in_progress');
    },

    getPendingGoals: () => {
      const goals = Array.from(get().goals.values());
      return goals
        .filter((g) => g.status === 'pending')
        .sort((a, b) => b.priority - a.priority);
    },

    addMessage: (message) => {
      set((s) => {
        const messages = [...s.messages, message];
        if (messages.length > MAX_MESSAGES) {
          messages.shift();
        }
        return { messages };
      });
    },

    clearMessages: () => set({ messages: [] }),

    addChatMessage: (message) => {
      set((s) => {
        const chatHistory = [...s.chatHistory, message];
        if (chatHistory.length > MAX_CHAT_HISTORY) {
          chatHistory.shift();
        }
        return { chatHistory };
      });
    },

    clearChatHistory: () => set({ chatHistory: [] }),

    setConnected: (connected) => set({ isConnected: connected }),

    reset: () =>
      set({
        agent: null,
        goals: new Map(),
        messages: [],
        chatHistory: [],
        isConnected: false,
      }),
  }))
);
