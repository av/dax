import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AgentState } from '@/types';
import type { FileNode } from '@/types';
import { createPlan } from '@/agent/planner';
import { buildNestedTree } from '@/utils/treeUtils';
import { theme } from '@/theme';

function collectRootNodes(): FileNode[] {
  return buildNestedTree();
}

export default function CommandBar() {
  const isOpen = useAgentStore((s) => s.isCommandBarOpen);
  const closeCommandBar = useAgentStore((s) => s.closeCommandBar);
  const setGoal = useAgentStore((s) => s.setGoal);
  const setPlan = useAgentStore((s) => s.setPlan);
  const setSteps = useAgentStore((s) => s.setSteps);
  const setStatus = useAgentStore((s) => s.setStatus);
  const addLogEntry = useAgentStore((s) => s.addLogEntry);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const prefill = useAgentStore.getState().prefillCommand;
      if (prefill) {
        setInput(prefill);
        useAgentStore.getState().setPrefillCommand(null);
      } else {
        setInput('');
      }
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const goal = input.trim();
      if (!goal || isLoading) return;

      setIsLoading(true);
      setStatus(AgentState.Thinking);
      setGoal(goal);
      addLogEntry(`New goal: ${goal}`, 'info');

      setRecentCommands((prev) => {
        const filtered = prev.filter((c) => c !== goal);
        return [goal, ...filtered].slice(0, 5);
      });

      try {
        const settings = useSettingsStore.getState().settings;
        const fileTree = collectRootNodes();
        const steps = await createPlan(goal, fileTree, settings.llm);
        setPlan(steps);
        setSteps(steps);

        const hasFailed = steps.some((s) => s.status === 'failed');
        if (hasFailed) {
          setStatus(AgentState.Error);
          addLogEntry('Plan creation failed — see plan panel for details.', 'error');
        } else {
          setStatus(AgentState.WaitingApproval);
          addLogEntry(`Plan created: ${steps.length} step(s). Awaiting approval.`, 'info');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        setStatus(AgentState.Error);
        addLogEntry(`Error creating plan: ${msg}`, 'error');
      } finally {
        setIsLoading(false);
        closeCommandBar();
      }
    },
    [input, isLoading, setStatus, setGoal, addLogEntry, setPlan, setSteps, closeCommandBar],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandBar();
      }
    },
    [closeCommandBar],
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
        background: `${theme.colors.textPrimary}4D`,
        zIndex: 100,
        pointerEvents: 'auto',
        animation: 'commandBarFadeIn 0.15s ease-out',
      }}
      onClick={closeCommandBar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: `${theme.colors.bgSurface}FA`,
          border: `1px solid ${theme.colors.borderDefault}`,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: `0 20px 60px ${theme.colors.textPrimary}33`,
          animation: 'commandBarScaleIn 0.15s ease-out',
        }}
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              gap: '10px',
              borderBottom: `1px solid ${theme.colors.borderDefault}`,
            }}
          >
            <span style={{ color: theme.colors.accentPrimary, fontSize: '16px', flexShrink: 0 }}>
              ✦
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell the agent what to do…"
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: theme.colors.textPrimary,
                fontSize: '15px',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            />
            {isLoading && (
              <span
                style={{
                  color: theme.colors.statusWarning,
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  animation: 'commandBarPulse 1s ease-in-out infinite',
                }}
              >
                Thinking…
              </span>
            )}
          </div>
        </form>

        {recentCommands.length > 0 && !isLoading && (
          <div style={{ padding: '8px 0' }}>
            <div
              style={{
                padding: '4px 16px',
                fontSize: '11px',
                color: theme.colors.textSecondary,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Recent
            </div>
            {recentCommands.map((cmd) => (
              <div
                key={cmd}
                onClick={() => setInput(cmd)}
                style={{
                  padding: '6px 16px 6px 42px',
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    `${theme.colors.accentPrimary}14`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                {cmd}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${theme.colors.borderDefault}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '11px', color: theme.colors.textSecondary, fontFamily: 'monospace' }}>
            ⌘K to toggle · Esc to dismiss
          </span>
          <span style={{ fontSize: '11px', color: theme.colors.textSecondary, fontFamily: 'monospace' }}>
            ↵ Submit
          </span>
        </div>
      </div>

      <style>{`
        @keyframes commandBarFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes commandBarScaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes commandBarPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
