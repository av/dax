import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AgentConfig, AgentTool, MCPConfig, OpenAPIConfig } from '@/types';
import { 
  Settings, Plus, Trash2, History, FileText, Bot, Save, 
  X, Edit, ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  Sparkles, Zap, Globe
} from 'lucide-react';
import { getDatabaseInstance } from '@/services/database';

// Single-user desktop app - always use admin user
const USER_ID = 'admin';

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

export const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'tools' | 'history' | 'log'>('agents');
  const [agents, setAgents] = useState<(AgentConfig & { id: string })[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<(AgentConfig & { id: string }) | null>(null);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Load agents from database on mount
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const db = getDatabaseInstance();
      const loadedAgents = await db.getAgentConfigs(USER_ID);
      setAgents(loadedAgents);
      if (loadedAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(loadedAgents[0].id!);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const createNewAgent = () => {
    setEditingAgent({
      id: `agent-${Date.now()}`,
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

    try {
      const db = getDatabaseInstance();
      await db.saveAgentConfig(editingAgent, USER_ID);
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
      await db.deleteAgentConfig(id, USER_ID);
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
      id: `tool-${Date.now()}`,
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

  const selectedAgentData = agents.find(a => a.id === selectedAgent);

  const renderIcon = (icon: string, iconType: 'lucide' | 'emoji') => {
    if (iconType === 'emoji') {
      return <span className="text-xl">{icon}</span>;
    }
    // For lucide icons, we'll use Bot as default
    return <Bot className="h-5 w-5" />;
  };

  const addKeyValuePair = (field: 'headers' | 'queryParams', key: string = '', value: string = '') => {
    if (!editingAgent) return;
    
    setEditingAgent({
      ...editingAgent,
      [field]: {
        ...editingAgent[field],
        [key || `key-${Date.now()}`]: value,
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
    <div className="w-96 bg-white dark:bg-gray-800 border-l flex flex-col">
      {/* Sidebar Tabs */}
      <div className="border-b flex">
        <button
          className={`flex-1 py-2 px-4 text-sm ${
            activeTab === 'agents' ? 'bg-primary text-primary-foreground' : ''
          }`}
          onClick={() => setActiveTab('agents')}
        >
          <Bot className="h-4 w-4 inline mr-1" />
          Agents
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm ${
            activeTab === 'tools' ? 'bg-primary text-primary-foreground' : ''
          }`}
          onClick={() => setActiveTab('tools')}
        >
          <Settings className="h-4 w-4 inline mr-1" />
          Tools
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm ${
            activeTab === 'history' ? 'bg-primary text-primary-foreground' : ''
          }`}
          onClick={() => setActiveTab('history')}
        >
          <History className="h-4 w-4 inline mr-1" />
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm ${
            activeTab === 'log' ? 'bg-primary text-primary-foreground' : ''
          }`}
          onClick={() => setActiveTab('log')}
        >
          <FileText className="h-4 w-4 inline mr-1" />
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'agents' && (
          <div className="space-y-4">
            {!showAgentForm ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Agents</h3>
                  <Button size="sm" onClick={createNewAgent}>
                    <Plus className="h-4 w-4 mr-1" />
                    New Agent
                  </Button>
                </div>

                {agents.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No agents configured. Create one to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agents.map((agent) => (
                      <Card
                        key={agent.id}
                        className={`cursor-pointer transition-colors ${
                          selectedAgent === agent.id ? 'border-primary' : ''
                        }`}
                        onClick={() => setSelectedAgent(agent.id!)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              {renderIcon(agent.icon, agent.iconType)}
                              <div>
                                <div className="font-medium text-sm">{agent.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {agent.preset || 'Custom'}
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  editAgent(agent);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteAgent(agent.id!);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedAgentData && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-base">Agent Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">API URL:</span>
                        <div className="text-xs text-muted-foreground break-all">
                          {selectedAgentData.apiUrl}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Tools:</span>
                        <div className="text-xs text-muted-foreground">
                          {selectedAgentData.tools?.length || 0} configured
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                    onChange={(e) =>
                      setEditingAgent(editingAgent ? { ...editingAgent, name: e.target.value } : null)
                    }
                    placeholder="My Agent"
                  />
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
                      className="w-full mt-1 px-3 py-2 border rounded text-sm"
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
                    onChange={(e) =>
                      setEditingAgent(editingAgent ? { ...editingAgent, apiUrl: e.target.value } : null)
                    }
                    placeholder="https://api.example.com/v1/chat"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">API Key (optional)</label>
                  <Input
                    type="password"
                    value={editingAgent?.apiKey || ''}
                    onChange={(e) =>
                      setEditingAgent(editingAgent ? { ...editingAgent, apiKey: e.target.value } : null)
                    }
                    placeholder="sk-..."
                  />
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
                    className="w-full mt-1 px-3 py-2 border rounded min-h-[80px] text-xs font-mono"
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
                    className="w-full mt-1 px-3 py-2 border rounded min-h-[80px] text-sm"
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
                            className="w-full px-2 py-1 border rounded text-xs"
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
                {selectedAgentData.tools?.map((tool, index) => (
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
            <h3 className="font-semibold mb-4">History</h3>
            <div className="text-center text-muted-foreground text-sm py-8">
              History feature coming soon
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="space-y-2">
            <h3 className="font-semibold mb-4">Logs</h3>
            <div className="text-center text-muted-foreground text-sm py-8">
              Logging feature coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
