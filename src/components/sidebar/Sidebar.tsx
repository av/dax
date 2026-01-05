import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AgentConfig, AgentTool, MCPConfig, OpenAPIConfig } from '@/types';
import { agentService, AgentMessage } from '@/services/agent';
import { validators } from '@/lib/validation';
import { generateUUID } from '@/lib/utils';
import {
  Settings, Plus, Trash2, History, FileText, Bot, Save,
  X, Edit, ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  Sparkles, Zap, Globe, LucideIcon, Send, Loader2, AlertCircle
} from 'lucide-react';
import { getDatabaseInstance } from '@/services/database';
import { DEFAULT_USER_ID } from '@/lib/constants';

// Presets for popular API providers
const API_PRESETS = {
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    icon: 'Sparkles',
    iconType: 'lucide' as const,
    headers: { 'Content-Type': 'application/json' },
    queryParams: {},
    extraBody: { model: 'gpt-4' },
  },
  openrouter: {
    name: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    icon: 'Zap',
    iconType: 'lucide' as const,
    headers: { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://dax.local' },
    queryParams: {},
    extraBody: { model: 'openai/gpt-4' },
  },
  anthropic: {
    name: 'Anthropic',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    icon: 'Globe',
    iconType: 'lucide' as const,
    headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    queryParams: {},
    extraBody: { model: 'claude-3-opus-20240229' },
  },
};

// Icon mapping for Lucide icons
const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Bot,
  Sparkles,
  Zap,
  Globe,
  Settings,
  History,
  FileText,
};

export const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'tools' | 'history' | 'log'>('agents');
  const [agents, setAgents] = useState<(AgentConfig & { id: string })[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<(AgentConfig & { id: string }) | null>(null);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<AgentMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load agents from database on mount
  useEffect(() => {
    loadAgents();
  }, []);

  // Load activity log when log tab is active and set up auto-refresh
  useEffect(() => {
    if (activeTab === 'log') {
      loadActivityLog();
      
      // Auto-refresh activity log every 3 seconds when the tab is active
      const intervalId = setInterval(() => {
        loadActivityLog();
      }, 3000);
      
      // Clean up interval when tab changes or component unmounts
      return () => clearInterval(intervalId);
    }
  }, [activeTab]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'agents' && !showAgentForm) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeTab, showAgentForm]);

  const loadAgents = async () => {
    try {
      const db = getDatabaseInstance();
      const loadedAgents = await db.getAgentConfigs(DEFAULT_USER_ID);
      setAgents(loadedAgents);
      if (loadedAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(loadedAgents[0].id!);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadActivityLog = async () => {
    try {
      const db = getDatabaseInstance();
      const logs = await db.getActivityLog(DEFAULT_USER_ID, 50);
      setActivityLog(logs);
    } catch (error) {
      console.error('Failed to load activity log:', error);
    }
  };

  const createNewAgent = () => {
    setEditingAgent({
      id: `agent-${generateUUID()}`,
      name: 'New Agent',
      icon: 'Bot',
      iconType: 'lucide',
      apiUrl: '',
      headers: {},
      queryParams: {},
      extraBody: {},
      preset: 'custom',
      temperature: 0.7,
      maxTokens: 2000,
      tools: [],
    });
    setShowAgentForm(true);
  };

  const editAgent = (agent: AgentConfig & { id: string }) => {
    setEditingAgent({ ...agent });
    setShowAgentForm(true);
  };

  const saveAgent = async () => {
    if (!editingAgent) return;

    // Validate agent configuration
    const errors: Record<string, string> = {};

    const nameError = validators.required(editingAgent.name);
    if (nameError) errors.name = nameError;

    const urlError = validators.url(editingAgent.apiUrl);
    if (urlError) errors.apiUrl = urlError;

    if (editingAgent.apiKey) {
      const keyError = validators.apiKey(editingAgent.apiKey);
      if (keyError) errors.apiKey = keyError;
    }

    if (editingAgent.temperature !== undefined) {
      const tempError = validators.temperature(editingAgent.temperature);
      if (tempError) errors.temperature = tempError;
    }

    if (editingAgent.maxTokens !== undefined) {
      const tokensError = validators.positiveInteger(editingAgent.maxTokens);
      if (tokensError) errors.maxTokens = tokensError;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    try {
      const db = getDatabaseInstance();
      await db.saveAgentConfig(editingAgent, DEFAULT_USER_ID);
      await loadAgents();
      setShowAgentForm(false);
      setEditingAgent(null);
      setSelectedAgent(editingAgent.id!);
    } catch (error) {
      console.error('Failed to save agent:', error);
    }
  };

  const deleteAgent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      const db = getDatabaseInstance();
      await db.deleteAgentConfig(id, DEFAULT_USER_ID);
      await loadAgents();
      if (selectedAgent === id) {
        setSelectedAgent(agents.length > 1 ? agents[0].id! : null);
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const applyPreset = (preset: keyof typeof API_PRESETS) => {
    if (!editingAgent) return;

    const presetConfig = API_PRESETS[preset];
    setEditingAgent({
      ...editingAgent,
      name: presetConfig.name,
      apiUrl: presetConfig.apiUrl,
      icon: presetConfig.icon,
      iconType: presetConfig.iconType,
      headers: presetConfig.headers,
      queryParams: presetConfig.queryParams,
      extraBody: presetConfig.extraBody,
      preset,
    });
  };

  const addTool = () => {
    if (!editingAgent) return;

    const newTool: AgentTool = {
      id: `tool-${generateUUID()}`,
      name: 'New Tool',
      description: '',
      type: 'mcp',
      enabled: true,
      config: {},
    };

    setEditingAgent({
      ...editingAgent,
      tools: [...(editingAgent.tools || []), newTool],
    });
  };

  const updateTool = (index: number, updates: Partial<AgentTool>) => {
    if (!editingAgent) return;

    const updatedTools = [...(editingAgent.tools || [])];
    updatedTools[index] = { ...updatedTools[index], ...updates };

    setEditingAgent({
      ...editingAgent,
      tools: updatedTools,
    });
  };

  const deleteTool = (index: number) => {
    if (!editingAgent) return;

    setEditingAgent({
      ...editingAgent,
      tools: (editingAgent.tools || []).filter((_, i) => i !== index),
    });
  };

  const toggleToolEnabled = (index: number) => {
    if (!editingAgent) return;

    const updatedTools = [...(editingAgent.tools || [])];
    updatedTools[index].enabled = !updatedTools[index].enabled;

    setEditingAgent({
      ...editingAgent,
      tools: updatedTools,
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedAgent || isExecuting) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    
    // Add user message to history
    const newHistory: AgentMessage[] = [
      ...chatHistory,
      { role: 'user', content: userMessage },
    ];
    setChatHistory(newHistory);
    setIsExecuting(true);

    try {
      const response = await agentService.chat(
        selectedAgent,
        userMessage,
        chatHistory
      );

      // Add assistant response to history
      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: response.content },
      ]);
    } catch (error) {
      console.error('Agent execution error:', error);
      setChatHistory([
        ...newHistory,
        { 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        },
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const clearChat = () => {
    if (confirm('Clear chat history?')) {
      setChatHistory([]);
    }
  };

  const selectedAgentData = agents.find(a => a.id === selectedAgent);

  const renderIcon = (icon: string, iconType: 'lucide' | 'emoji') => {
    if (iconType === 'emoji') {
      return <span className="text-xl">{icon}</span>;
    }
    // For lucide icons, look up the icon component by name
    const IconComponent = LUCIDE_ICON_MAP[icon] || Bot;
    return <IconComponent className="h-5 w-5" />;
  };

  const addKeyValuePair = (field: 'headers' | 'queryParams', key: string = '', value: string = '') => {
    if (!editingAgent) return;

    setEditingAgent({
      ...editingAgent,
      [field]: {
        ...editingAgent[field],
        [key || `key-${generateUUID()}`]: value,
      },
    });
  };

  const updateKeyValuePair = (field: 'headers' | 'queryParams', oldKey: string, newKey: string, value: string) => {
    if (!editingAgent) return;

    const updated = { ...editingAgent[field] };
    if (oldKey !== newKey) {
      delete updated[oldKey];
    }
    updated[newKey] = value;

    setEditingAgent({
      ...editingAgent,
      [field]: updated,
    });
  };

  const deleteKeyValuePair = (field: 'headers' | 'queryParams', key: string) => {
    if (!editingAgent) return;

    const updated = { ...editingAgent[field] };
    delete updated[key];

    setEditingAgent({
      ...editingAgent,
      [field]: updated,
    });
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col shadow-lg">
      {/* Sidebar Tabs */}
      <div className="border-b border-border flex bg-muted/50">
        <button
          className={`flex-1 py-3.5 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'agents'
              ? 'bg-background text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
          onClick={() => setActiveTab('agents')}
          aria-label="Agents"
          title="Agents"
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">Agents</span>
        </button>
        <button
          className={`flex-1 py-3.5 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'tools'
              ? 'bg-background text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
          onClick={() => setActiveTab('tools')}
          aria-label="Tools"
          title="Tools"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Tools</span>
        </button>
        <button
          className={`flex-1 py-3.5 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'history'
              ? 'bg-background text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
          onClick={() => setActiveTab('history')}
          aria-label="History"
          title="History"
        >
          <History className="h-4 w-4" />
        </button>
        <button
          className={`flex-1 py-3.5 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'log'
              ? 'bg-background text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
          onClick={() => setActiveTab('log')}
          aria-label="Activity Log"
          title="Activity Log"
        >
          <FileText className="h-4 w-4" />
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'agents' && (
          <div className="space-y-6">
            {!showAgentForm ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Agents</h3>
                  <Button size="default" onClick={createNewAgent} className="font-semibold shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Agent
                  </Button>
                </div>

                {agents.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-16 px-4">
                    <Bot className="h-16 w-16 mx-auto mb-4 opacity-40" />
                    <p className="font-semibold text-base mb-1">No agents configured</p>
                    <p className="text-sm">Create one to get started</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {agents.map((agent) => (
                        <Card
                          key={agent.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedAgent === agent.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-accent-foreground/20'
                          }`}
                          onClick={() => {
                            setSelectedAgent(agent.id!);
                            setChatHistory([]);
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center space-x-3 min-w-0 flex-1">
                                <div className="shrink-0">
                                  {renderIcon(agent.icon, agent.iconType)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm truncate">{agent.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {agent.preset || 'Custom'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex space-x-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-accent"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    editAgent(agent);
                                  }}
                                  aria-label="Edit agent"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteAgent(agent.id!);
                                  }}
                                  aria-label="Delete agent"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Chat Interface */}
                    {selectedAgent && selectedAgentData && (
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Chat with {selectedAgentData.name}</CardTitle>
                            <Button size="sm" variant="ghost" onClick={clearChat}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Chat history */}
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {chatHistory.length === 0 ? (
                              <div className="text-center text-sm text-muted-foreground py-4">
                                Start a conversation...
                              </div>
                            ) : (
                              chatHistory.map((msg, idx) => (
                                <div
                                  key={idx}
                                  className={`p-2 rounded text-sm ${
                                    msg.role === 'user'
                                      ? 'bg-blue-100 dark:bg-blue-900 ml-4'
                                      : msg.role === 'assistant'
                                      ? 'bg-slate-100 dark:bg-slate-800 mr-4'
                                      : 'bg-yellow-100 dark:bg-yellow-900 text-center'
                                  }`}
                                >
                                  <div className="font-semibold text-xs mb-1">
                                    {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? selectedAgentData.name : 'System'}
                                  </div>
                                  <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>
                              ))
                            )}
                            <div ref={chatEndRef} />
                          </div>

                          {/* Input */}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Type a message..."
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                              disabled={isExecuting}
                            />
                            <Button 
                              size="sm" 
                              onClick={handleSendMessage}
                              disabled={!chatInput.trim() || isExecuting}
                            >
                              {isExecuting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </>
            ) : (
              // Agent Form
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">
                    {editingAgent?.id?.startsWith('agent-') ? 'New Agent' : 'Edit Agent'}
                  </h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowAgentForm(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Presets */}
                <div>
                  <label className="text-sm font-medium">Quick Presets</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {Object.entries(API_PRESETS).map(([key, preset]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant="outline"
                        onClick={() => applyPreset(key as keyof typeof API_PRESETS)}
                        className="text-xs"
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Basic Info */}
                <div>
                  <label className="text-sm font-medium">Agent Name</label>
                  <Input
                    value={editingAgent?.name || ''}
                    onChange={(e) => {
                      setEditingAgent(editingAgent ? { ...editingAgent, name: e.target.value } : null);
                      if (validationErrors.name) {
                        setValidationErrors({ ...validationErrors, name: '' });
                      }
                    }}
                    placeholder="My Agent"
                    className={validationErrors.name ? 'border-red-500' : ''}
                  />
                  {validationErrors.name && (
                    <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.name}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium">Icon</label>
                    <Input
                      value={editingAgent?.icon || ''}
                      onChange={(e) =>
                        setEditingAgent(editingAgent ? { ...editingAgent, icon: e.target.value } : null)
                      }
                      placeholder="Bot or 🤖"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Icon Type</label>
                    <select
                      value={editingAgent?.iconType || 'lucide'}
                      onChange={(e) =>
                        setEditingAgent(
                          editingAgent
                            ? { ...editingAgent, iconType: e.target.value as 'lucide' | 'emoji' }
                            : null
                        )
                      }
                      className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded text-sm"
                    >
                      <option value="lucide">Lucide</option>
                      <option value="emoji">Emoji</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">API URL</label>
                  <Input
                    value={editingAgent?.apiUrl || ''}
                    onChange={(e) => {
                      setEditingAgent(editingAgent ? { ...editingAgent, apiUrl: e.target.value } : null);
                      if (validationErrors.apiUrl) {
                        setValidationErrors({ ...validationErrors, apiUrl: '' });
                      }
                    }}
                    placeholder="https://api.example.com/v1/chat"
                    className={validationErrors.apiUrl ? 'border-red-500' : ''}
                  />
                  {validationErrors.apiUrl && (
                    <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.apiUrl}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">API Key (optional)</label>
                  <Input
                    type="password"
                    value={editingAgent?.apiKey || ''}
                    onChange={(e) => {
                      setEditingAgent(editingAgent ? { ...editingAgent, apiKey: e.target.value } : null);
                      if (validationErrors.apiKey) {
                        setValidationErrors({ ...validationErrors, apiKey: '' });
                      }
                    }}
                    placeholder="sk-..."
                    className={validationErrors.apiKey ? 'border-red-500' : ''}
                  />
                  {validationErrors.apiKey && (
                    <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.apiKey}
                    </div>
                  )}
                </div>

                {/* Headers Section */}
                <div>
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('headers')}
                  >
                    <label className="text-sm font-medium">Headers</label>
                    {expandedSections['headers'] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                  {expandedSections['headers'] && (
                    <div className="mt-2 space-y-2">
                      {Object.entries(editingAgent?.headers || {}).map(([key, value]) => (
                        <div key={key} className="flex space-x-2">
                          <Input
                            placeholder="Key"
                            value={key}
                            onChange={(e) =>
                              updateKeyValuePair('headers', key, e.target.value, value as string)
                            }
                            className="text-xs"
                          />
                          <Input
                            placeholder="Value"
                            value={value as string}
                            onChange={(e) => updateKeyValuePair('headers', key, key, e.target.value)}
                            className="text-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteKeyValuePair('headers', key)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addKeyValuePair('headers')}
                        className="w-full text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Header
                      </Button>
                    </div>
                  )}
                </div>

                {/* Query Parameters Section */}
                <div>
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('queryParams')}
                  >
                    <label className="text-sm font-medium">Query Parameters</label>
                    {expandedSections['queryParams'] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                  {expandedSections['queryParams'] && (
                    <div className="mt-2 space-y-2">
                      {Object.entries(editingAgent?.queryParams || {}).map(([key, value]) => (
                        <div key={key} className="flex space-x-2">
                          <Input
                            placeholder="Key"
                            value={key}
                            onChange={(e) =>
                              updateKeyValuePair('queryParams', key, e.target.value, value as string)
                            }
                            className="text-xs"
                          />
                          <Input
                            placeholder="Value"
                            value={value as string}
                            onChange={(e) =>
                              updateKeyValuePair('queryParams', key, key, e.target.value)
                            }
                            className="text-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteKeyValuePair('queryParams', key)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addKeyValuePair('queryParams')}
                        className="w-full text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Parameter
                      </Button>
                    </div>
                  )}
                </div>

                {/* Extra Body (JSON) */}
                <div>
                  <label className="text-sm font-medium">Extra Body (JSON)</label>
                  <textarea
                    value={JSON.stringify(editingAgent?.extraBody || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setEditingAgent(editingAgent ? { ...editingAgent, extraBody: parsed } : null);
                      } catch (err) {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded min-h-[80px] text-xs font-mono"
                    placeholder='{"model": "gpt-4"}'
                  />
                </div>

                {/* Temperature & Max Tokens */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium">Temperature</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={editingAgent?.temperature || 0.7}
                      onChange={(e) =>
                        setEditingAgent(
                          editingAgent
                            ? { ...editingAgent, temperature: parseFloat(e.target.value) }
                            : null
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Max Tokens</label>
                    <Input
                      type="number"
                      value={editingAgent?.maxTokens || 2000}
                      onChange={(e) =>
                        setEditingAgent(
                          editingAgent ? { ...editingAgent, maxTokens: parseInt(e.target.value) } : null
                        )
                      }
                    />
                  </div>
                </div>

                {/* System Prompt */}
                <div>
                  <label className="text-sm font-medium">System Prompt</label>
                  <textarea
                    value={editingAgent?.systemPrompt || ''}
                    onChange={(e) =>
                      setEditingAgent(
                        editingAgent ? { ...editingAgent, systemPrompt: e.target.value } : null
                      )
                    }
                    className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded min-h-[80px] text-sm"
                    placeholder="You are a helpful assistant..."
                  />
                </div>

                {/* Tools */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium">Tools</label>
                    <Button size="sm" variant="outline" onClick={addTool}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Tool
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(editingAgent?.tools || []).map((tool, index) => (
                      <Card key={tool.id}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <Input
                              placeholder="Tool name"
                              value={tool.name}
                              onChange={(e) => updateTool(index, { name: e.target.value })}
                              className="text-xs flex-1 mr-2"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleToolEnabled(index)}
                            >
                              {tool.enabled ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteTool(index)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          <Input
                            placeholder="Description"
                            value={tool.description}
                            onChange={(e) => updateTool(index, { description: e.target.value })}
                            className="text-xs"
                          />

                          <select
                            value={tool.type}
                            onChange={(e) =>
                              updateTool(index, { type: e.target.value as 'mcp' | 'openapi' })
                            }
                            className="w-full px-2 py-1 border border-input bg-background text-foreground rounded text-xs"
                          >
                            <option value="mcp">MCP</option>
                            <option value="openapi">OpenAPI</option>
                          </select>

                          {tool.type === 'openapi' && (
                            <Input
                              placeholder="OpenAPI Spec URL"
                              value={(tool.config as OpenAPIConfig)?.specUrl || ''}
                              onChange={(e) =>
                                updateTool(index, {
                                  config: { ...(tool.config || {}), specUrl: e.target.value },
                                })
                              }
                              className="text-xs"
                            />
                          )}

                          {tool.type === 'mcp' && (
                            <Input
                              placeholder="MCP Server URL (optional)"
                              value={(tool.config as MCPConfig)?.serverUrl || ''}
                              onChange={(e) =>
                                updateTool(index, {
                                  config: { ...(tool.config || {}), serverUrl: e.target.value },
                                })
                              }
                              className="text-xs"
                            />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex space-x-2 pt-4 border-t">
                  <Button onClick={saveAgent} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Save Agent
                  </Button>
                  <Button variant="outline" onClick={() => setShowAgentForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tools' && selectedAgentData && (
          <div className="space-y-4">
            <h3 className="font-semibold">Tools for {selectedAgentData.name}</h3>
            {(selectedAgentData.tools || []).length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                No tools configured for this agent.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedAgentData.tools?.map((tool) => (
                  <Card key={tool.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{tool.name}</div>
                          <div className="text-xs text-muted-foreground">{tool.description}</div>
                          <div className="text-xs text-blue-600 mt-1">Type: {tool.type}</div>
                        </div>
                        <div>
                          {tool.enabled ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Agent History</h3>
              <Button size="sm" variant="ghost" onClick={loadActivityLog}>
                <History className="h-4 w-4" />
              </Button>
            </div>
            {selectedAgentData ? (
              <div className="space-y-2">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">
                      Agent interaction history will appear here once agent execution is implemented.
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center text-muted-foreground text-sm py-8">
                Select an agent to view its history
              </div>
            )}
          </div>
        )}

        {activeTab === 'log' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Activity Log</h3>
              <Button size="sm" variant="ghost" onClick={loadActivityLog}>
                <History className="h-4 w-4" />
              </Button>
            </div>
            {activityLog.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                No activity logged yet
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {activityLog.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-xs font-medium">{log.action}</div>
                          {log.resourceType && (
                            <div className="text-xs text-muted-foreground">
                              {log.resourceType}: {log.resourceId}
                            </div>
                          )}
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {JSON.stringify(log.details)}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
