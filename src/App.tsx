import { useEffect, useRef } from 'react';
import { useFileTreeStore } from './stores/fileTreeStore';
import { useOnboardingStore } from './stores/onboardingStore';
import { useAgentStore } from './stores/agentStore';
import Workspace from './scene/Workspace';
import HUD from './ui/HUD';
import Onboarding from './ui/Onboarding';
import ToastContainer, { useToastStore } from './ui/Toast';
import ErrorBoundary from './utils/errorBoundary';
import { theme } from './theme';

function SkippedOpenFolder() {
  const openFolder = useFileTreeStore((s) => s.openFolder);
  const isLoading = useFileTreeStore((s) => s.isLoading);
  return (
    <button
      onClick={() => void openFolder()}
      disabled={isLoading}
      style={{
        padding: '12px 32px',
        fontSize: '16px',
        background: isLoading ? theme.colors.bgBase : 'transparent',
        color: theme.colors.accentPrimary,
        border: `1px solid ${theme.colors.accentPrimary}`,
        borderRadius: '8px',
        cursor: isLoading ? 'wait' : 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {isLoading ? 'Opening\u2026' : 'Open a Folder'}
    </button>
  );
}

function App() {
  const rootPath = useFileTreeStore((s) => s.rootPath);
  const isOnboarding = useOnboardingStore((s) => s.isOnboarding);
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const currentStep = useOnboardingStore((s) => s.currentStep);

  // Watch for first successful agent step to show a toast
  const hasShownFirstActionToast = useOnboardingStore((s) => s.hasShownFirstActionToast);
  const markFirstActionToastShown = useOnboardingStore((s) => s.markFirstActionToastShown);
  const agentSteps = useAgentStore((s) => s.steps);
  const prevDoneCountRef = useRef(0);

  useEffect(() => {
    if (hasShownFirstActionToast) return;
    const doneCount = agentSteps.filter((s) => s.status === 'done').length;
    if (doneCount > prevDoneCountRef.current && doneCount >= 1) {
      useToastStore.getState().addToast(
        'You can approve, edit, or reject any step.',
        'info',
        5000,
      );
      markFirstActionToastShown();
    }
    prevDoneCountRef.current = doneCount;
  }, [agentSteps, hasShownFirstActionToast, markFirstActionToastShown]);

  // Show onboarding folder select when no folder is open
  if (!rootPath && isOnboarding && currentStep === 'folderSelect') {
    return (
      <>
        <Onboarding />
        <ToastContainer />
      </>
    );
  }

  if (!rootPath && !isOnboarding) {
    // Onboarding was skipped but no folder open — show minimal open button
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.colors.bgBase,
          color: theme.colors.textPrimary,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          gap: '24px',
        }}
      >
        <h1
          style={{
            fontSize: '3rem',
            fontWeight: 300,
            letterSpacing: '0.25em',
            opacity: 0.8,
            margin: 0,
            color: theme.colors.accentPrimary,
          }}
        >
          Dax
        </h1>
        <SkippedOpenFolder />
        <ToastContainer />
      </div>
    );
  }

  // Folder is open — render 3D workspace with HUD overlay
  return (
    <ErrorBoundary>
      <div
        style={{ position: 'relative', width: '100vw', height: '100vh' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* 3D Scene */}
        <Workspace />

        {/* HUD Overlay (top bar, bottom bar, detail panel, context menu, bulk actions) */}
        <HUD />

        {/* Onboarding steps (agent intro, command hint) */}
        {isOnboarding && !hasCompletedOnboarding && <Onboarding />}

        {/* Toast notifications */}
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;
