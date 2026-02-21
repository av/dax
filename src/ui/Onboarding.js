import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
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
    const [overlayState, setOverlayState] = useState('entering');
    const [agentTooltipVisible, setAgentTooltipVisible] = useState(false);
    const agentTooltipTimer = useRef(null);
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
                if (agentTooltipTimer.current)
                    clearTimeout(agentTooltipTimer.current);
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
        if (agentTooltipTimer.current)
            clearTimeout(agentTooltipTimer.current);
        setAgentTooltipVisible(false);
        if (currentStep === 'agentIntro') {
            nextStep();
        }
    }, [currentStep, nextStep]);
    const handleOpenFolder = useCallback(() => {
        void openFolder();
    }, [openFolder]);
    // ── Render nothing if onboarding complete ────────────
    if (!isOnboarding && currentStep === 'complete')
        return null;
    return (_jsxs(_Fragment, { children: [currentStep === 'folderSelect' && overlayState !== 'hidden' && (_jsxs("div", { style: {
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0a0a0f',
                    color: '#e0e0e0',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    zIndex: 500,
                    opacity: overlayState === 'exiting' ? 0 : overlayState === 'entering' ? 0 : 1,
                    transition: 'opacity 0.6s ease',
                    animation: overlayState === 'entering' ? 'none' : undefined,
                }, children: [_jsx("h1", { style: {
                            fontSize: '4.5rem',
                            fontWeight: 200,
                            letterSpacing: '0.3em',
                            margin: 0,
                            color: '#7aa2f7',
                            animation: 'daxOnboardTitleIn 0.8s ease-out both',
                            animationDelay: '0.2s',
                            textShadow: '0 0 40px rgba(122, 162, 247, 0.3)',
                        }, children: "Dax" }), _jsx("p", { style: {
                            fontSize: '1.1rem',
                            color: '#565f89',
                            marginTop: '12px',
                            marginBottom: '48px',
                            letterSpacing: '0.08em',
                            animation: 'daxOnboardSubtitleIn 0.8s ease-out both',
                            animationDelay: '0.5s',
                        }, children: "3D File Workspace with AI Agent" }), _jsx("button", { onClick: handleOpenFolder, disabled: isLoading, style: {
                            padding: '14px 44px',
                            fontSize: '16px',
                            fontWeight: 500,
                            background: isLoading ? '#1a1b26' : 'transparent',
                            color: '#7aa2f7',
                            border: '1px solid #7aa2f7',
                            borderRadius: '10px',
                            cursor: isLoading ? 'wait' : 'pointer',
                            fontFamily: 'inherit',
                            letterSpacing: '0.04em',
                            animation: 'daxOnboardButtonIn 0.6s ease-out both',
                            animationDelay: '0.8s',
                            transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
                            boxShadow: '0 0 20px rgba(122, 162, 247, 0.15)',
                        }, onMouseEnter: (e) => {
                            if (!isLoading) {
                                e.currentTarget.style.background = 'rgba(122, 162, 247, 0.1)';
                                e.currentTarget.style.boxShadow = '0 0 30px rgba(122, 162, 247, 0.3)';
                                e.currentTarget.style.transform = 'scale(1.03)';
                            }
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.background = isLoading ? '#1a1b26' : 'transparent';
                            e.currentTarget.style.boxShadow = '0 0 20px rgba(122, 162, 247, 0.15)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }, children: isLoading ? 'Opening…' : 'Open a Folder' }), error && (_jsx("p", { style: { color: '#f7768e', fontSize: '14px', marginTop: '20px' }, children: error })), _jsx("button", { onClick: skipOnboarding, style: {
                            position: 'absolute',
                            bottom: '32px',
                            right: '32px',
                            background: 'none',
                            border: 'none',
                            color: '#3b3f52',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            padding: '4px 8px',
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.color = '#565f89';
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.color = '#3b3f52';
                        }, children: "Skip" }), _jsx("style", { children: `
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
          ` })] })), agentTooltipVisible && (_jsxs("div", { style: {
                    position: 'fixed',
                    top: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 150,
                    pointerEvents: 'auto',
                    animation: 'daxAgentTooltipIn 0.4s ease-out both',
                }, children: [_jsxs("div", { style: {
                            background: 'rgba(26, 27, 38, 0.95)',
                            border: '1px solid #4A90D9',
                            borderRadius: '10px',
                            padding: '14px 22px',
                            color: '#c0caf5',
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 12px rgba(74,144,217,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            maxWidth: '400px',
                        }, children: [_jsx("span", { style: { fontSize: '20px', flexShrink: 0 }, children: "\u2726" }), _jsx("span", { children: "I'm your workspace agent. Tell me what to do." }), _jsx("button", { onClick: dismissAgentTooltip, style: {
                                    background: 'none',
                                    border: 'none',
                                    color: '#565f89',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    padding: '0 0 0 8px',
                                    lineHeight: 1,
                                    flexShrink: 0,
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.color = '#9aa5ce';
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.color = '#565f89';
                                }, children: "\u00D7" })] }), _jsx("div", { style: {
                            width: 0,
                            height: 0,
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderBottom: '8px solid #4A90D9',
                            margin: '0 auto',
                            transform: 'rotate(180deg)',
                            marginTop: '-1px',
                        } }), _jsx("style", { children: `
            @keyframes daxAgentTooltipIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          ` })] }))] }));
}
