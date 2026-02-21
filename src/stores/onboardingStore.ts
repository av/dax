import { create } from 'zustand';

export type OnboardingStep =
  | 'folderSelect'
  | 'animating'
  | 'agentIntro'
  | 'commandHint'
  | 'complete';

interface OnboardingState {
  currentStep: OnboardingStep;
  isOnboarding: boolean;
  hasCompletedOnboarding: boolean;
  /** Whether the first agent action has already triggered the toast */
  hasShownFirstActionToast: boolean;

  nextStep: () => void;
  skipOnboarding: () => void;
  reset: () => void;
  markFirstActionToastShown: () => void;
}

const STEP_ORDER: OnboardingStep[] = [
  'folderSelect',
  'animating',
  'agentIntro',
  'commandHint',
  'complete',
];

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 'folderSelect',
  isOnboarding: true,
  hasCompletedOnboarding: false,
  hasShownFirstActionToast: false,

  nextStep: () =>
    set((state) => {
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

  skipOnboarding: () =>
    set({
      currentStep: 'complete',
      isOnboarding: false,
      hasCompletedOnboarding: true,
    }),

  reset: () =>
    set({
      currentStep: 'folderSelect',
      isOnboarding: true,
      hasCompletedOnboarding: false,
      hasShownFirstActionToast: false,
    }),

  markFirstActionToastShown: () => set({ hasShownFirstActionToast: true }),
}));
