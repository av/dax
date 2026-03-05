/**
 * ChatPanel: bottom-bar chat input + message history + speech bubbles.
 * Solid.js component for user↔agent communication.
 */
import { type Component, Show, For, createSignal, createEffect, onMount } from 'solid-js';
import { agentState } from '../../state/agent';
import { showChat, setShowChat } from '../../state/ui';
import { processUserMessage, addChatMessage, acceptAutoLearn, dismissAutoLearn } from '../../agent/chat-handler';
import type { ChatMessageRow } from '../../db/types';

export interface ChatPanelProps {
  sessionId: string | null;
}

export const ChatPanel: Component<ChatPanelProps> = (props) => {
  const [inputValue, setInputValue] = createSignal('');
  const [isProcessing, setIsProcessing] = createSignal(false);
  let messagesEndRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    const _msgs = agentState.chatMessages;
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Listen for custom focus event (from `/` key)
  onMount(() => {
    const handler = () => {
      if (inputRef) {
        setShowChat(true);
        inputRef.focus();
      }
    };
    window.addEventListener('dax:focus-chat', handler);
    return () => window.removeEventListener('dax:focus-chat', handler);
  });

  async function handleSend(): Promise<void> {
    const text = inputValue().trim();
    if (!text || isProcessing()) return;

    setInputValue('');
    setIsProcessing(true);

    // Add user message
    await addChatMessage('user', text, props.sessionId);

    // Add "Working on it..." acknowledgment
    await addChatMessage('agent', 'Working on it...', props.sessionId);

    try {
      // Process the message
      const result = await processUserMessage(text, props.sessionId);

      // Replace the "Working on it..." with the actual result
      // (We remove last agent message and add the real one)
      const msgs = [...agentState.chatMessages];
      // Remove the "Working on it..." message (last agent message)
      const lastAgentIdx = msgs.length - 1;
      if (lastAgentIdx >= 0 && msgs[lastAgentIdx].role === 'agent') {
        msgs.splice(lastAgentIdx, 1);
      }
      // We can't directly remove from the store easily, so we add the real response
      await addChatMessage('agent', result.message, props.sessionId);
    } catch (err) {
      await addChatMessage('agent', `Error: ${(err as Error).message}`, props.sessionId);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowChat(false);
    }
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Show when={showChat()}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={headerTitleStyle}>Chat</span>
          <button style={closeButtonStyle} onClick={() => setShowChat(false)} title="Close">
            ✕
          </button>
        </div>

        {/* Messages */}
        <div style={messagesContainerStyle}>
          <For each={agentState.chatMessages}>
            {(msg: ChatMessageRow) => (
              <div
                style={{
                  ...messageBubbleBase,
                  ...(msg.role === 'user' ? userBubbleStyle : agentBubbleStyle),
                }}
              >
                <Show when={msg.role === 'agent'}>
                  <span style={avatarIconStyle}>🤖</span>
                </Show>
                <div style={messageContentStyle}>
                  <span style={messageTextStyle}>{msg.content}</span>
                  <span style={timestampStyle}>{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            )}
          </For>

          {/* Auto-learn proposal */}
          <Show when={agentState.autoLearnProposal}>
            <div style={autoLearnStyle}>
              <span style={autoLearnTextStyle}>
                Should I remember this for next time? When you say "{agentState.autoLearnProposal?.trigger}", I'll {agentState.autoLearnProposal?.action}.
              </span>
              <div style={autoLearnButtonsStyle}>
                <button style={acceptButtonStyle} onClick={acceptAutoLearn}>
                  Yes, remember
                </button>
                <button style={dismissButtonStyle} onClick={dismissAutoLearn}>
                  No thanks
                </button>
              </div>
            </div>
          </Show>

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={inputContainerStyle}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask the agent..."
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Mark text input focused to suppress keyboard shortcuts
              const event = new CustomEvent('dax:text-input-focus', { detail: true });
              window.dispatchEvent(event);
            }}
            onBlur={() => {
              const event = new CustomEvent('dax:text-input-focus', { detail: false });
              window.dispatchEvent(event);
            }}
            style={inputStyle}
            disabled={isProcessing()}
          />
          <button
            style={sendButtonStyle}
            onClick={handleSend}
            disabled={isProcessing() || !inputValue().trim()}
          >
            {isProcessing() ? '...' : '→'}
          </button>
        </div>
      </div>
    </Show>
  );
};

// ── Styles ──

const panelStyle: Record<string, string> = {
  position: 'fixed',
  bottom: '0',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '600px',
  'max-width': '90vw',
  'max-height': '400px',
  display: 'flex',
  'flex-direction': 'column',
  background: 'rgba(22, 22, 38, 0.95)',
  'border-top': '1px solid rgba(233, 69, 96, 0.3)',
  'border-left': '1px solid rgba(233, 69, 96, 0.15)',
  'border-right': '1px solid rgba(233, 69, 96, 0.15)',
  'border-radius': '12px 12px 0 0',
  'backdrop-filter': 'blur(12px)',
  'pointer-events': 'auto',
  'z-index': '1000',
  'box-shadow': '0 -4px 20px rgba(0, 0, 0, 0.4)',
};

const headerStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '8px 16px',
  'border-bottom': '1px solid rgba(255, 255, 255, 0.06)',
};

const headerTitleStyle: Record<string, string> = {
  'font-size': '13px',
  'font-weight': '600',
  color: '#e94560',
  'letter-spacing': '1px',
  'text-transform': 'uppercase',
};

const closeButtonStyle: Record<string, string> = {
  background: 'none',
  border: 'none',
  color: '#8a8a9a',
  'font-size': '14px',
  cursor: 'pointer',
  padding: '2px 6px',
};

const messagesContainerStyle: Record<string, string> = {
  flex: '1',
  overflow: 'auto',
  padding: '12px 16px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'max-height': '280px',
};

const messageBubbleBase: Record<string, string> = {
  display: 'flex',
  'align-items': 'flex-start',
  gap: '8px',
  'max-width': '85%',
  padding: '8px 12px',
  'border-radius': '12px',
  'font-size': '13px',
  'line-height': '1.4',
};

const userBubbleStyle: Record<string, string> = {
  'align-self': 'flex-end',
  background: 'rgba(233, 69, 96, 0.2)',
  color: '#eee',
  'border-bottom-right-radius': '4px',
};

const agentBubbleStyle: Record<string, string> = {
  'align-self': 'flex-start',
  background: 'rgba(255, 255, 255, 0.06)',
  color: '#d0d0e0',
  'border-bottom-left-radius': '4px',
};

const avatarIconStyle: Record<string, string> = {
  'font-size': '16px',
  'flex-shrink': '0',
  'margin-top': '1px',
};

const messageContentStyle: Record<string, string> = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
};

const messageTextStyle: Record<string, string> = {
  'word-break': 'break-word',
};

const timestampStyle: Record<string, string> = {
  'font-size': '10px',
  color: '#6a6a7a',
  'align-self': 'flex-end',
};

const inputContainerStyle: Record<string, string> = {
  display: 'flex',
  gap: '8px',
  padding: '12px 16px',
  'border-top': '1px solid rgba(255, 255, 255, 0.06)',
};

const inputStyle: Record<string, string> = {
  flex: '1',
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  'border-radius': '8px',
  color: '#eee',
  'font-size': '13px',
  padding: '8px 12px',
  outline: 'none',
  'font-family': 'inherit',
};

const sendButtonStyle: Record<string, string> = {
  background: 'rgba(233, 69, 96, 0.3)',
  border: '1px solid rgba(233, 69, 96, 0.5)',
  'border-radius': '8px',
  color: '#e94560',
  'font-size': '16px',
  'font-weight': '700',
  padding: '8px 14px',
  cursor: 'pointer',
  'flex-shrink': '0',
};

const autoLearnStyle: Record<string, string> = {
  background: 'rgba(233, 169, 69, 0.15)',
  border: '1px solid rgba(233, 169, 69, 0.3)',
  'border-radius': '10px',
  padding: '10px 12px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
};

const autoLearnTextStyle: Record<string, string> = {
  color: '#e0c080',
  'font-size': '12px',
  'line-height': '1.4',
};

const autoLearnButtonsStyle: Record<string, string> = {
  display: 'flex',
  gap: '8px',
};

const acceptButtonStyle: Record<string, string> = {
  background: 'rgba(80, 200, 120, 0.2)',
  border: '1px solid rgba(80, 200, 120, 0.4)',
  'border-radius': '6px',
  color: '#50c878',
  'font-size': '11px',
  padding: '4px 10px',
  cursor: 'pointer',
};

const dismissButtonStyle: Record<string, string> = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  'border-radius': '6px',
  color: '#8a8a9a',
  'font-size': '11px',
  padding: '4px 10px',
  cursor: 'pointer',
};
