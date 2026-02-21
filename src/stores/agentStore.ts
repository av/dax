import { create } from 'zustand';
import { AgentState } from '@/types';
import type { AgentStep } from '@/types';

// ── Types ──────────────────────────────────────────────

export type Vec3Tuple = [number, number, number];

export interface ActivityLogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface AgentStoreState {
  // Visual / spatial state
  status: AgentState;
  targetPosition: Vec3Tuple | null;
  currentPosition: Vec3Tuple;
  isVisible: boolean;

  // Planning state
  currentGoal: string | null;
  currentStep: AgentStep | null;
  plan: AgentStep[];
  activityLog: ActivityLogEntry[];
  approvedStepIds: string[];
  isCommandBarOpen: boolean;
  prefillCommand: string | null;

  // Legacy compat
  steps: AgentStep[];

  // Actions — visual
  setStatus: (status: AgentState) => void;
  moveTo: (position: Vec3Tuple) => void;
  setIdle: () => void;
  setVisible: (visible: boolean) => void;
  updatePosition: (position: Vec3Tuple) => void;

  // Actions — planning
  setGoal: (goal: string) => void;
  setPlan: (steps: AgentStep[]) => void;
  completeStep: (stepId: string) => void;
  setSteps: (steps: AgentStep[]) => void;
  updateStep: (id: string, partial: Partial<AgentStep>) => void;
  addLogEntry: (message: string, type?: 'info' | 'success' | 'error') => void;

  // Actions — approval
  approveStep: (id: string) => void;
  approveAll: () => void;
  rejectStep: (id: string) => void;

  // Actions — command bar
  openCommandBar: () => void;
  closeCommandBar: () => void;
  toggleCommandBar: () => void;
  setPrefillCommand: (text: string | null) => void;

  reset: () => void;
}

const initialState = {
  status: AgentState.Idle,
  targetPosition: null as Vec3Tuple | null,
  currentPosition: [0, 3, 0] as Vec3Tuple,
  isVisible: true,

  currentGoal: null as string | null,
  currentStep: null as AgentStep | null,
  plan: [] as AgentStep[],
  activityLog: [] as ActivityLogEntry[],
  approvedStepIds: [] as string[],
  isCommandBarOpen: false,
  prefillCommand: null as string | null,
  steps: [] as AgentStep[],
};

export const useAgentStore = create<AgentStoreState>((set) => ({
  ...initialState,

  // ── Visual actions ────────────────────────────────────

  setStatus: (status: AgentState) => set({ status }),

  moveTo: (position: Vec3Tuple) =>
    set({ targetPosition: position, status: AgentState.Acting }),

  setIdle: () =>
    set({ targetPosition: null, status: AgentState.Idle, currentStep: null }),

  setVisible: (visible: boolean) => set({ isVisible: visible }),

  updatePosition: (position: Vec3Tuple) => set({ currentPosition: position }),

  // ── Planning actions ──────────────────────────────────

  setGoal: (goal: string) => set({ currentGoal: goal }),

  setPlan: (steps: AgentStep[]) =>
    set({ plan: steps, steps, currentStep: steps[0] ?? null }),

  completeStep: (stepId: string) =>
    set((s) => {
      const updatedPlan = s.plan.map((step) =>
        step.id === stepId ? { ...step, status: 'done' as const } : step,
      );
      const updatedSteps = s.steps.map((step) =>
        step.id === stepId ? { ...step, status: 'done' as const } : step,
      );
      const nextPending = updatedPlan.find(
        (step) => step.status === 'pending' || step.status === 'approved',
      );
      return { plan: updatedPlan, steps: updatedSteps, currentStep: nextPending ?? null };
    }),

  setSteps: (steps: AgentStep[]) => set({ steps }),

  updateStep: (id: string, partial: Partial<AgentStep>) =>
    set((s) => ({
      steps: s.steps.map((step) =>
        step.id === id ? { ...step, ...partial } : step,
      ),
      plan: s.plan.map((step) =>
        step.id === id ? { ...step, ...partial } : step,
      ),
    })),

  addLogEntry: (message: string, type: 'info' | 'success' | 'error' = 'info') =>
    set((s) => ({
      activityLog: [
        ...s.activityLog,
        { timestamp: Date.now(), message, type },
      ],
    })),

  // ── Approval actions ──────────────────────────────────

  approveStep: (id: string) =>
    set((s) => ({
      approvedStepIds: [...s.approvedStepIds, id],
      steps: s.steps.map((step) =>
        step.id === id ? { ...step, status: 'approved' as const } : step,
      ),
      plan: s.plan.map((step) =>
        step.id === id ? { ...step, status: 'approved' as const } : step,
      ),
    })),

  approveAll: () =>
    set((s) => {
      const pendingIds = s.steps
        .filter((step) => step.status === 'pending')
        .map((step) => step.id);
      return {
        approvedStepIds: [...s.approvedStepIds, ...pendingIds],
        steps: s.steps.map((step) =>
          step.status === 'pending' ? { ...step, status: 'approved' as const } : step,
        ),
        plan: s.plan.map((step) =>
          step.status === 'pending' ? { ...step, status: 'approved' as const } : step,
        ),
        status: AgentState.WaitingApproval,
      };
    }),

  rejectStep: (id: string) =>
    set((s) => ({
      approvedStepIds: s.approvedStepIds.filter((sid) => sid !== id),
      steps: s.steps.map((step) =>
        step.id === id ? { ...step, status: 'rejected' as const } : step,
      ),
      plan: s.plan.map((step) =>
        step.id === id ? { ...step, status: 'rejected' as const } : step,
      ),
    })),

  // ── Command bar actions ───────────────────────────────

  openCommandBar: () => set({ isCommandBarOpen: true }),
  closeCommandBar: () => set({ isCommandBarOpen: false }),
  toggleCommandBar: () => set((s) => ({ isCommandBarOpen: !s.isCommandBarOpen })),
  setPrefillCommand: (text: string | null) => set({ prefillCommand: text }),

  reset: () => set(initialState),
}));
