import { create } from 'zustand';
const STEP_ORDER = [
    'folderSelect',
    'animating',
    'agentIntro',
    'commandHint',
    'complete',
];
export const useOnboardingStore = create((set) => ({
    currentStep: 'folderSelect',
    isOnboarding: true,
    hasCompletedOnboarding: false,
    hasShownFirstActionToast: false,
    nextStep: () => set((state) => {
        const idx = STEP_ORDER.indexOf(state.currentStep);
        const next = STEP_ORDER[idx + 1];
        if (!next || next === 'complete') {
            return {
                currentStep: 'complete',
                isOnboarding: false,
                hasCompletedOnboarding: true,
            };
        }
        return { currentStep: next };
    }),
    skipOnboarding: () => set({
        currentStep: 'complete',
        isOnboarding: false,
        hasCompletedOnboarding: true,
    }),
    reset: () => set({
        currentStep: 'folderSelect',
        isOnboarding: true,
        hasCompletedOnboarding: false,
        hasShownFirstActionToast: false,
    }),
    markFirstActionToastShown: () => set({ hasShownFirstActionToast: true }),
}));
