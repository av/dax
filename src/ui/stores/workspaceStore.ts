import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import type { Workspace, CameraState, WorkspaceSettings } from '@/types';
import type { ChatMessage } from '@/types/agent';
import { createDefaultCameraState, createDefaultWorkspaceSettings } from '@/types';

export interface WorkspaceState {
  currentWorkspace: Workspace | null;
  recentWorkspaces: Array<{ id: string; name: string; path: string; lastOpenedAt: number }>;
  isDirty: boolean;
  lastSavedAt: number | null;

  setWorkspace: (workspace: Workspace | null) => void;
  updateCamera: (camera: Partial<CameraState>) => void;
  updateSettings: (settings: Partial<WorkspaceSettings>) => void;
  addObjectId: (id: string) => void;
  removeObjectId: (id: string) => void;

  // Chat history persistence
  addChatMessage: (message: ChatMessage) => void;
  setChatHistory: (messages: ChatMessage[]) => void;
  clearChatHistory: () => void;
  getChatHistory: () => ChatMessage[];

  markDirty: () => void;
  markSaved: () => void;

  addRecentWorkspace: (workspace: { id: string; name: string; path: string }) => void;
  clearRecentWorkspaces: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        currentWorkspace: null,
        recentWorkspaces: [],
        isDirty: false,
        lastSavedAt: null,

        setWorkspace: (workspace) => {
          set({ currentWorkspace: workspace, isDirty: false });
          if (workspace) {
            get().addRecentWorkspace({
              id: workspace.id,
              name: workspace.name,
              path: workspace.path,
            });
          }
        },

        updateCamera: (camera) => {
          set((state) => {
            if (!state.currentWorkspace) return state;
            return {
              currentWorkspace: {
                ...state.currentWorkspace,
                camera: { ...state.currentWorkspace.camera, ...camera },
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        updateSettings: (settings) => {
          set((state) => {
            if (!state.currentWorkspace) return state;
            return {
              currentWorkspace: {
                ...state.currentWorkspace,
                settings: { ...state.currentWorkspace.settings, ...settings },
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        addObjectId: (id) => {
          set((state) => {
            if (!state.currentWorkspace) return state;
            if (state.currentWorkspace.objectIds.includes(id)) return state;
            return {
              currentWorkspace: {
                ...state.currentWorkspace,
                objectIds: [...state.currentWorkspace.objectIds, id],
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        removeObjectId: (id) => {
          set((state) => {
            if (!state.currentWorkspace) return state;
            return {
              currentWorkspace: {
                ...state.currentWorkspace,
                objectIds: state.currentWorkspace.objectIds.filter((oid) => oid !== id),
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        addChatMessage: (message) => {
          set((state) => {
            if (!state.currentWorkspace) return state;
            const MAX_CHAT_HISTORY = 500;
            const chatHistory = [...state.currentWorkspace.chatHistory, message];
            // Trim older messages if exceeding max
            if (chatHistory.length > MAX_CHAT_HISTORY) {
              chatHistory.splice(0, chatHistory.length - MAX_CHAT_HISTORY);
            }
            return {
              currentWorkspace: {
                ...state.currentWorkspace,
                chatHistory,
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        setChatHistory: (messages) => {
          set((state) => {
            if (!state.currentWorkspace) return state;
            return {
              currentWorkspace: {
                ...state.currentWorkspace,
                chatHistory: messages,
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        clearChatHistory: () => {
          set((state) => {
            if (!state.currentWorkspace) return state;
            return {
              currentWorkspace: {
                ...state.currentWorkspace,
                chatHistory: [],
                updatedAt: Date.now(),
              },
              isDirty: true,
            };
          });
        },

        getChatHistory: () => {
          const state = get();
          return state.currentWorkspace?.chatHistory ?? [];
        },

        markDirty: () => set({ isDirty: true }),
        markSaved: () => set({ isDirty: false, lastSavedAt: Date.now() }),

        addRecentWorkspace: (workspace) => {
          set((state) => {
            const filtered = state.recentWorkspaces.filter((w) => w.id !== workspace.id);
            const recent = [
              { ...workspace, lastOpenedAt: Date.now() },
              ...filtered,
            ].slice(0, 10);
            return { recentWorkspaces: recent };
          });
        },

        clearRecentWorkspaces: () => set({ recentWorkspaces: [] }),
      }),
      {
        name: 'dax-workspace',
        partialize: (state) => ({
          recentWorkspaces: state.recentWorkspaces,
        }),
      }
    )
  )
);

export function getDefaultCamera(): CameraState {
  return createDefaultCameraState();
}

export function getDefaultSettings(): WorkspaceSettings {
  return createDefaultWorkspaceSettings();
}
