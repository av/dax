import { create } from 'zustand';
import { AgentState } from '@/types';
const initialState = {
    status: AgentState.Idle,
    targetPosition: null,
    currentPosition: [0, 3, 0],
    isVisible: true,
    currentGoal: null,
    currentStep: null,
    plan: [],
    activityLog: [],
    approvedStepIds: [],
    isCommandBarOpen: false,
    prefillCommand: null,
    steps: [],
};
export const useAgentStore = create((set) => ({
    ...initialState,
    // ── Visual actions ────────────────────────────────────
    setStatus: (status) => set({ status }),
    moveTo: (position) => set({ targetPosition: position, status: AgentState.Acting }),
    setIdle: () => set({ targetPosition: null, status: AgentState.Idle, currentStep: null }),
    setVisible: (visible) => set({ isVisible: visible }),
    updatePosition: (position) => set({ currentPosition: position }),
    // ── Planning actions ──────────────────────────────────
    setGoal: (goal) => set({ currentGoal: goal }),
    setPlan: (steps) => set({ plan: steps, steps, currentStep: steps[0] ?? null }),
    completeStep: (stepId) => set((s) => {
        const updatedPlan = s.plan.map((step) => step.id === stepId ? { ...step, status: 'done' } : step);
        const updatedSteps = s.steps.map((step) => step.id === stepId ? { ...step, status: 'done' } : step);
        const nextPending = updatedPlan.find((step) => step.status === 'pending' || step.status === 'approved');
        return { plan: updatedPlan, steps: updatedSteps, currentStep: nextPending ?? null };
    }),
    setSteps: (steps) => set({ steps }),
    updateStep: (id, partial) => set((s) => ({
        steps: s.steps.map((step) => step.id === id ? { ...step, ...partial } : step),
        plan: s.plan.map((step) => step.id === id ? { ...step, ...partial } : step),
    })),
    addLogEntry: (message, type = 'info') => set((s) => ({
        activityLog: [
            ...s.activityLog,
            { timestamp: Date.now(), message, type },
        ],
    })),
    // ── Approval actions ──────────────────────────────────
    approveStep: (id) => set((s) => ({
        approvedStepIds: [...s.approvedStepIds, id],
        steps: s.steps.map((step) => step.id === id ? { ...step, status: 'approved' } : step),
        plan: s.plan.map((step) => step.id === id ? { ...step, status: 'approved' } : step),
    })),
    approveAll: () => set((s) => {
        const pendingIds = s.steps
            .filter((step) => step.status === 'pending')
            .map((step) => step.id);
        return {
            approvedStepIds: [...s.approvedStepIds, ...pendingIds],
            steps: s.steps.map((step) => step.status === 'pending' ? { ...step, status: 'approved' } : step),
            plan: s.plan.map((step) => step.status === 'pending' ? { ...step, status: 'approved' } : step),
            status: AgentState.WaitingApproval,
        };
    }),
    rejectStep: (id) => set((s) => ({
        approvedStepIds: s.approvedStepIds.filter((sid) => sid !== id),
        steps: s.steps.map((step) => step.id === id ? { ...step, status: 'rejected' } : step),
        plan: s.plan.map((step) => step.id === id ? { ...step, status: 'rejected' } : step),
    })),
    // ── Command bar actions ───────────────────────────────
    openCommandBar: () => set({ isCommandBarOpen: true }),
    closeCommandBar: () => set({ isCommandBarOpen: false }),
    toggleCommandBar: () => set((s) => ({ isCommandBarOpen: !s.isCommandBarOpen })),
    setPrefillCommand: (text) => set({ prefillCommand: text }),
    reset: () => set(initialState),
}));
