import { useEffect, useRef, useState, useCallback } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { theme } from '@/theme';

// ── Types ──────────────────────────────────────────────

type VisualState = 'entering' | 'visible' | 'exiting' | 'hidden';

// ── Component ──────────────────────────────────────────

export default function Onboarding() {
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const isOnboarding = useOnboardingStore((s) => s.isOnboarding);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const skipOnboarding = useOnboardingStore((s) => s.skipOnboarding);

  const isLoading = useFileTreeStore((s) => s.isLoading);
  const error = useFileTreeStore((s) => s.error);
  const openFolder = useFileTreeStore((s) => s.openFolder);
  const rootPath = useFileTreeStore((s) => s.rootPath);

  // Track overlay visual state for animated exit
  const [overlayState, setOverlayState] = useState<VisualState>('entering');
  const [agentTooltipVisible, setAgentTooltipVisible] = useState(false);
  const agentTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After mount, set to visible
  useEffect(() => {
    const t = setTimeout(() => setOverlayState('visible'), 50);
    return () => clearTimeout(t);
  }, []);

  // Transition from folderSelect → animating when a folder is opened
  useEffect(() => {
    if (currentStep === 'folderSelect' && rootPath) {
      // Fade out overlay, then move to animating step
      setOverlayState('exiting');
      const t = setTimeout(() => {
        setOverlayState('hidden');
        nextStep(); // → 'animating'
      }, 600);
      return () => clearTimeout(t);
    }
  }, [currentStep, rootPath, nextStep]);

  // Transition from animating → agentIntro after animation time
  useEffect(() => {
    if (currentStep === 'animating') {
      // Max 2s animation time
      const t = setTimeout(() => {
        nextStep(); // → 'agentIntro'
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [currentStep, nextStep]);

  // Show agent tooltip, auto-dismiss after 5s
  useEffect(() => {
    if (currentStep === 'agentIntro') {
      setAgentTooltipVisible(true);
      agentTooltipTimer.current = setTimeout(() => {
        setAgentTooltipVisible(false);
        nextStep(); // → 'commandHint'
      }, 5000);
      return () => {
        if (agentTooltipTimer.current) clearTimeout(agentTooltipTimer.current);
      };
    }
  }, [currentStep, nextStep]);

  // Auto-advance from commandHint after 6s (or user can interact)
  useEffect(() => {
    if (currentStep === 'commandHint') {
      const t = setTimeout(() => {
        nextStep(); // → 'complete'
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [currentStep, nextStep]);

  const dismissAgentTooltip = useCallback(() => {
    if (agentTooltipTimer.current) clearTimeout(agentTooltipTimer.current);
    setAgentTooltipVisible(false);
    if (currentStep === 'agentIntro') {
      nextStep();
    }
  }, [currentStep, nextStep]);

  const handleOpenFolder = useCallback(() => {
    void openFolder();
  }, [openFolder]);

  // ── Render nothing if onboarding complete ────────────
  if (!isOnboarding && currentStep === 'complete') return null;

  return (
    <>
      {/* ── Folder Select Overlay ──────────────────── */}
      {currentStep === 'folderSelect' && overlayState !== 'hidden' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.colors.bgBase,
            color: theme.colors.textPrimary,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            zIndex: 500,
            opacity: overlayState === 'exiting' ? 0 : overlayState === 'entering' ? 0 : 1,
            transition: 'opacity 0.6s ease',
            animation: overlayState === 'entering' ? 'none' : undefined,
          }}
        >
          {/* Logo / Title */}
          <h1
            style={{
              fontSize: '4.5rem',
              fontWeight: 200,
              letterSpacing: '0.3em',
              margin: 0,
              color: theme.colors.accentPrimary,
              animation: 'daxOnboardTitleIn 0.8s ease-out both',
              animationDelay: '0.2s',
              textShadow: `0 0 40px ${theme.colors.accentPrimary}4D`,
            }}
          >
            Dax
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '1.1rem',
              color: theme.colors.textSecondary,
              marginTop: '12px',
              marginBottom: '48px',
              letterSpacing: '0.08em',
              animation: 'daxOnboardSubtitleIn 0.8s ease-out both',
              animationDelay: '0.5s',
            }}
          >
            3D File Workspace with AI Agent
          </p>

          {/* Open Folder Button */}
          <button
            onClick={handleOpenFolder}
            disabled={isLoading}
            style={{
              padding: '14px 44px',
              fontSize: '16px',
              fontWeight: 500,
              background: isLoading ? theme.colors.bgBase : 'transparent',
              color: theme.colors.accentPrimary,
              border: `1px solid ${theme.colors.accentPrimary}`,
              borderRadius: '10px',
              cursor: isLoading ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.04em',
              animation: 'daxOnboardButtonIn 0.6s ease-out both',
              animationDelay: '0.8s',
              transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
              boxShadow: `0 0 20px ${theme.colors.accentPrimary}26`,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                (e.currentTarget as HTMLButtonElement).style.background = `${theme.colors.accentPrimary}1A`;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 30px ${theme.colors.accentPrimary}4D`;
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.03)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = isLoading ? theme.colors.bgBase : 'transparent';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${theme.colors.accentPrimary}26`;
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            {isLoading ? 'Opening…' : 'Open a Folder'}
          </button>

          {error && (
            <p style={{ color: theme.colors.statusError, fontSize: '14px', marginTop: '20px' }}>{error}</p>
          )}

          {/* Skip link */}
          <button
            onClick={skipOnboarding}
            style={{
              position: 'absolute',
              bottom: '32px',
              right: '32px',
              background: 'none',
              border: 'none',
              color: theme.colors.bgBase,
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              padding: '4px 8px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = theme.colors.textSecondary;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = theme.colors.bgBase;
            }}
          >
            Skip
          </button>

          <style>{`
            @keyframes daxOnboardTitleIn {
              from { opacity: 0; transform: scale(0.92) translateY(10px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes daxOnboardSubtitleIn {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes daxOnboardButtonIn {
              from { opacity: 0; transform: translateY(12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* ── Agent Intro Tooltip ────────────────────── */}
      {agentTooltipVisible && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 150,
            pointerEvents: 'auto',
            animation: 'daxAgentTooltipIn 0.4s ease-out both',
          }}
        >
          <div
            style={{
              background: `${theme.colors.bgSurface}F2`,
              border: `1px solid ${theme.colors.accentPrimary}`,
              borderRadius: '10px',
              padding: '14px 22px',
              color: theme.colors.textPrimary,
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              boxShadow: `0 8px 32px ${theme.colors.textPrimary}33, 0 0 12px ${theme.colors.accentPrimary}33`,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '400px',
            }}
          >
            <span style={{ fontSize: '20px', flexShrink: 0 }}>✦</span>
            <span>I&apos;m your workspace agent. Tell me what to do.</span>
            <button
              onClick={dismissAgentTooltip}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 0 0 8px',
                lineHeight: 1,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = theme.colors.textSecondary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = theme.colors.textSecondary;
              }}
            >
              ×
            </button>
          </div>

          {/* Arrow pointing up */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderBottom: `8px solid ${theme.colors.accentPrimary}`,
              margin: '0 auto',
              transform: 'rotate(180deg)',
              marginTop: '-1px',
            }}
          />

          <style>{`
            @keyframes daxAgentTooltipIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
