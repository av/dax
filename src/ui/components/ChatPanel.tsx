import { useState, useEffect, useRef, useCallback } from 'react';
import { useAgentStore } from '../stores/agentStore';
import type { ChatMessage } from '@/types';
import { sceneEvents } from '@/engine/events';

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agent = useAgentStore((state) => state.agent);
  const chatHistory = useAgentStore((state) => state.chatHistory);
  const addChatMessage = useAgentStore((state) => state.addChatMessage);
  const isConnected = useAgentStore((state) => state.isConnected);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamingResponse]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    addChatMessage(userMessage);
    setInputValue('');
    setIsLoading(true);
    setStreamingResponse('');

    // Emit chat command to agent system
    sceneEvents.emit('command:agent:chat', {
      message: userMessage.content,
      messageId: userMessage.id,
    });

    // For now, simulate a response (will be replaced with LLM integration)
    // The actual LLM response will come through the event system
    try {
      // This will be handled by the LLMBridge
      await handleAgentResponse(userMessage.content);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: 'Sorry, I encountered an error processing your message.',
        timestamp: Date.now(),
      };
      addChatMessage(errorMessage);
    } finally {
      setIsLoading(false);
      setStreamingResponse('');
    }
  }, [inputValue, isLoading, addChatMessage]);

  const handleAgentResponse = async (userContent: string): Promise<void> => {
    // Parse for commands first
    const command = parseUserCommand(userContent);

    if (command) {
      await executeCommand(command);
    } else {
      // Regular chat - will be handled by LLM
      const agentMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: getSimulatedResponse(userContent),
        timestamp: Date.now(),
      };
      addChatMessage(agentMessage);
    }
  };

  const parseUserCommand = (content: string): UserCommand | null => {
    const lower = content.toLowerCase().trim();

    if (lower === 'pause' || lower === 'stop') {
      return { type: 'pause' };
    }
    if (lower === 'resume' || lower === 'continue') {
      return { type: 'resume' };
    }
    if (lower.startsWith('focus on') || lower.startsWith('look at')) {
      const target = content.replace(/^(focus on|look at)\s*/i, '').trim();
      return { type: 'focus', target };
    }
    if (lower.startsWith('analyze') || lower.startsWith('examine')) {
      const target = content.replace(/^(analyze|examine)\s*/i, '').trim();
      return { type: 'analyze', target };
    }
    if (lower.startsWith('go to') || lower.startsWith('move to')) {
      const target = content.replace(/^(go to|move to)\s*/i, '').trim();
      return { type: 'goto', target };
    }
    if (lower === 'what are you doing?' || lower === 'status') {
      return { type: 'status' };
    }

    return null;
  };

  const executeCommand = async (command: UserCommand): Promise<void> => {
    let response = '';

    switch (command.type) {
      case 'pause':
        sceneEvents.emit('command:agent:pause', {});
        response = "I'm pausing my current activities. Let me know when you want me to continue.";
        break;

      case 'resume':
        sceneEvents.emit('command:agent:resume', {});
        response = "Resuming my work. I'll continue where I left off.";
        break;

      case 'status':
        if (agent) {
          response = `I'm currently ${agent.state}. ${getStateDescription(agent.state)}`;
        } else {
          response = "I'm not fully initialized yet.";
        }
        break;

      case 'focus':
        response = `I'll focus on "${command.target}". Looking for it on the plane...`;
        // This would trigger object search and focus
        break;

      case 'analyze':
        response = `I'll analyze "${command.target}" for you. Let me take a closer look...`;
        break;

      case 'goto':
        response = `Moving to "${command.target}"...`;
        break;

      default:
        response = "I understand. Let me think about that...";
    }

    const agentMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      content: response,
      timestamp: Date.now(),
    };
    addChatMessage(agentMessage);
  };

  const getSimulatedResponse = (userContent: string): string => {
    // Simple pattern matching for demo purposes
    // This will be replaced with actual LLM responses
    const lower = userContent.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi')) {
      return "Hello! I'm Dax, your AI assistant. I'm here to help you organize and analyze the files on your data plane. What would you like me to do?";
    }
    if (lower.includes('help')) {
      return "I can help you in several ways:\n• Analyze files and find patterns\n• Organize related documents\n• Summarize content\n• Execute code in a sandbox\n\nYou can also tell me to 'pause' or 'resume', or ask me to focus on specific objects.";
    }
    if (lower.includes('what can you do')) {
      return "I can navigate around the data plane, analyze files, find relationships between documents, and help organize your workspace. I can also execute code in a sandboxed environment when needed.";
    }

    return "I've noted that. I'll factor it into my analysis. Is there anything specific you'd like me to focus on?";
  };

  const getStateDescription = (state: string): string => {
    const descriptions: Record<string, string> = {
      idle: 'I\'m ready and waiting for something to do.',
      moving: 'I\'m navigating to a target location.',
      analyzing: 'I\'m examining an object in detail.',
      thinking: 'I\'m processing information with my language model.',
      executing: 'I\'m running some code in the sandbox.',
      waiting: 'I\'m waiting for your input or approval.',
      paused: 'I\'m paused. Tell me to resume when ready.',
    };
    return descriptions[state] || '';
  };

  const handleSaveAsSnippet = useCallback((content: string) => {
    // Create a snippet from the agent's response
    sceneEvents.emit('command:spawn-object', {
      type: 'snippet',
      position: { x: Math.random() * 4 - 2, y: 0.5, z: Math.random() * 4 - 2 },
      data: {
        title: 'Agent Response',
        content: content,
        tags: ['agent-response'],
        color: '#45b7d1', // Code/reference color
      },
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const formatMessageContent = (content: string): React.ReactNode => {
    // Simple markdown-like formatting
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line.startsWith('• ') ? (
          <span className="chat-bullet">{line}</span>
        ) : (
          line
        )}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-agent-name">{agent?.name || 'Dax'}</span>
          <span className={`chat-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {agent?.state || 'offline'}
          </span>
        </div>
        <button className="chat-close" onClick={onClose} aria-label="Close chat">
          ×
        </button>
      </div>

      <div className="chat-messages">
        {chatHistory.length === 0 && (
          <div className="chat-empty">
            <p>👋 Hi! I'm Dax, your AI assistant.</p>
            <p>Ask me anything or give me commands like:</p>
            <ul>
              <li>"What are you doing?"</li>
              <li>"Pause" / "Resume"</li>
              <li>"Analyze [file name]"</li>
              <li>"Help"</li>
            </ul>
          </div>
        )}

        {chatHistory.map((message) => (
          <div
            key={message.id}
            className={`chat-message chat-message-${message.role}`}
          >
            <div className="chat-message-header">
              <span className="chat-message-role">
                {message.role === 'user' ? 'You' : agent?.name || 'Dax'}
              </span>
              <span className="chat-message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
              {message.role === 'agent' && (
                <button
                  className="chat-message-action"
                  onClick={() => handleSaveAsSnippet(message.content)}
                  title="Save as Snippet"
                >
                  📝
                </button>
              )}
            </div>
            <div className="chat-message-content">
              {formatMessageContent(message.content)}
            </div>
          </div>
        ))}

        {streamingResponse && (
          <div className="chat-message chat-message-agent streaming">
            <div className="chat-message-header">
              <span className="chat-message-role">{agent?.name || 'Dax'}</span>
            </div>
            <div className="chat-message-content">
              {streamingResponse}
              <span className="typing-indicator">▊</span>
            </div>
          </div>
        )}

        {isLoading && !streamingResponse && (
          <div className="chat-loading">
            <div className="chat-loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder={isLoading ? 'Thinking...' : 'Type a message...'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="chat-send"
          onClick={handleSendMessage}
          disabled={isLoading || !inputValue.trim()}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

// Types for parsed user commands
interface UserCommand {
  type: 'pause' | 'resume' | 'focus' | 'analyze' | 'goto' | 'status';
  target?: string;
}

export default ChatPanel;
