import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AgentConfig, AgentTool } from '@/types';
import { Settings, Plus, Trash2, History, FileText } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agent' | 'tools' | 'history' | 'log'>('agent');
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    tools: [],
  });

  const [tools, setTools] = useState<AgentTool[]>([
    { name: 'read_canvas', description: 'Read canvas nodes', type: 'read_canvas' },
    { name: 'write_canvas', description: 'Write to canvas', type: 'write_canvas' },
    { name: 'query_rdf', description: 'Query RDF data', type: 'query_rdf' },
  ]);

  const [history, setHistory] = useState<string[]>([
    'Agent initialized',
    'Canvas loaded',
    'Data source connected',
  ]);

  const addTool = () => {
    const newTool: AgentTool = {
      name: 'new_tool',
      description: 'New tool',
      type: 'custom',
    };
    setTools([...tools, newTool]);
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l flex flex-col">
      {/* Sidebar Tabs */}
      <div className="border-b flex">
        <button
          className={`flex-1 py-2 px-4 text-sm ${
            activeTab === 'agent' ? 'bg-primary text-primary-foreground' : ''
          }`}
          onClick={() => setActiveTab('agent')}
        >
          <Settings className="h-4 w-4 inline mr-1" />
          Agent
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm ${
            activeTab === 'tools' ? 'bg-primary text-primary-foreground' : ''
          }`}
          onClick={() => setActiveTab('tools')}
        >
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
        {activeTab === 'agent' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Agent Configuration</CardTitle>
              <CardDescription>OpenAI Chat Completion API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Provider</label>
                <select
                  value={agentConfig.provider}
                  onChange={(e) =>
                    setAgentConfig({ ...agentConfig, provider: e.target.value as any })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Model</label>
                <Input
                  value={agentConfig.model}
                  onChange={(e) =>
                    setAgentConfig({ ...agentConfig, model: e.target.value })
                  }
                  placeholder="gpt-4"
                />
              </div>

              <div>
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={agentConfig.apiKey || ''}
                  onChange={(e) =>
                    setAgentConfig({ ...agentConfig, apiKey: e.target.value })
                  }
                  placeholder="sk-..."
                />
              </div>

              <div>
                <label className="text-sm font-medium">Temperature</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={agentConfig.temperature}
                  onChange={(e) =>
                    setAgentConfig({
                      ...agentConfig,
                      temperature: parseFloat(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Max Tokens</label>
                <Input
                  type="number"
                  value={agentConfig.maxTokens}
                  onChange={(e) =>
                    setAgentConfig({
                      ...agentConfig,
                      maxTokens: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">System Prompt</label>
                <textarea
                  value={agentConfig.systemPrompt || ''}
                  onChange={(e) =>
                    setAgentConfig({ ...agentConfig, systemPrompt: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded min-h-[100px] text-sm"
                  placeholder="You are a helpful assistant..."
                />
              </div>

              <Button className="w-full">Save Configuration</Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Agent Tools</h3>
              <Button size="sm" onClick={addTool}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {tools.map((tool, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{tool.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tool.description}
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Type: {tool.type}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTools(tools.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            <h3 className="font-semibold mb-4">History</h3>
            {history.map((item, index) => (
              <div
                key={index}
                className="p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm"
              >
                {item}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'log' && (
          <div className="space-y-2">
            <h3 className="font-semibold mb-4">Logs</h3>
            <div className="font-mono text-xs space-y-1">
              <div>[INFO] System initialized</div>
              <div>[INFO] Canvas ready</div>
              <div>[INFO] Agent configured</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
