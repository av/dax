import React, { useState, useEffect } from 'react';
import { CanvasNode, DataSource } from '@/types';
import { CanvasNodeComponent } from './CanvasNode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Folder, AlertCircle, Workflow, FileInput, Bot, Cog, FileOutput } from 'lucide-react';
import { getDatabaseInstance } from '@/services/database';
import { DataSourceService } from '@/services/dataSource';
import { validators, sanitizers } from '@/lib/validation';
import { DEFAULT_USER_ID } from '@/lib/constants';
import { generateUUID } from '@/lib/utils';

export const Canvas: React.FC = () => {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [selectedNodeType, setSelectedNodeType] = useState<'data' | 'agent' | 'transform' | 'output'>('data');
  const [isLoading, setIsLoading] = useState(true);
  const [configuringNode, setConfiguringNode] = useState<CanvasNode | null>(null);
  const [previewingNode, setPreviewingNode] = useState<CanvasNode | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [configDataSource, setConfigDataSource] = useState<DataSource>({
    type: 'fs',
    path: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Calculate workflow phase based on nodes
  const getWorkflowPhase = () => {
    if (nodes.length === 0) return 'setup';
    
    const hasData = nodes.some(n => n.type === 'data' && n.config?.source);
    const hasAgent = nodes.some(n => n.type === 'agent');
    const hasTransform = nodes.some(n => n.type === 'transform');
    const hasOutput = nodes.some(n => n.type === 'output');
    
    if (hasOutput) return 'export';
    if (hasTransform) return 'analyze';
    if (hasAgent || hasData) return 'explore';
    return 'setup';
  };

  const workflowPhase = getWorkflowPhase();

  // Load nodes from database on mount
  useEffect(() => {
    loadNodes();
  }, []);

  // Listen for canvas-cleared event to refresh nodes
  useEffect(() => {
    const handleCanvasCleared = () => {
      loadNodes();
    };

    window.addEventListener('canvas-cleared', handleCanvasCleared);
    return () => {
      window.removeEventListener('canvas-cleared', handleCanvasCleared);
    };
  }, []);

  const loadNodes = async () => {
    try {
      const db = getDatabaseInstance();
      const loadedNodes = await db.getCanvasNodes(DEFAULT_USER_ID);
      setNodes(loadedNodes);
    } catch (error) {
      console.error('Failed to load canvas nodes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addNode = async () => {
    const newNode: CanvasNode = {
      id: `node-${generateUUID()}`,
      type: selectedNodeType,
      title: `${selectedNodeType.charAt(0).toUpperCase() + selectedNodeType.slice(1)} Node`,
      x: Math.random() * 400 + 50,
      y: Math.random() * 300 + 50,
      width: 200,
      height: 150,
      data: {},
      config: {},
    };

    try {
      const db = getDatabaseInstance();
      await db.saveCanvasNode(newNode, DEFAULT_USER_ID);
      setNodes([...nodes, newNode]);
    } catch (error) {
      console.error('Failed to add node:', error);
    }
  };

  const updateNode = async (updatedNode: CanvasNode) => {
    try {
      const db = getDatabaseInstance();
      await db.saveCanvasNode(updatedNode, DEFAULT_USER_ID);
      setNodes(nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  };

  const deleteNode = async (id: string) => {
    try {
      const db = getDatabaseInstance();
      await db.deleteCanvasNode(id, DEFAULT_USER_ID);
      setNodes(nodes.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  const duplicateNode = async (node: CanvasNode) => {
    const newNode: CanvasNode = {
      ...node,
      id: `node-${generateUUID()}`,
      x: node.x + 20,
      y: node.y + 20,
    };

    try {
      const db = getDatabaseInstance();
      await db.saveCanvasNode(newNode, DEFAULT_USER_ID);
      setNodes([...nodes, newNode]);
    } catch (error) {
      console.error('Failed to duplicate node:', error);
    }
  };

  const batchDelete = async () => {
    try {
      const db = getDatabaseInstance();
      // Delete all nodes from database
      await Promise.all(nodes.map(node => db.deleteCanvasNode(node.id, DEFAULT_USER_ID)));
      setNodes([]);
    } catch (error) {
      console.error('Failed to delete all nodes:', error);
    }
  };

  const multiAddNodes = async () => {
    if (nodes.length === 0) {
      return;
    }

    // Spread nodes out in a grid pattern to avoid overlap
    const duplicatedNodes = nodes.map((n, index) => ({
      ...n,
      id: `node-${generateUUID()}`,
      x: n.x + 250 + (index % 3) * 50, // Offset significantly to the right with some variation
      y: n.y + Math.floor(index / 3) * 200, // Stack in rows of 3
    }));

    try {
      const db = getDatabaseInstance();
      await Promise.all(duplicatedNodes.map(node => db.saveCanvasNode(node, DEFAULT_USER_ID)));
      setNodes([...nodes, ...duplicatedNodes]);
    } catch (error) {
      console.error('Failed to multi-add nodes:', error);
    }
  };

  const configureNode = (node: CanvasNode) => {
    setConfiguringNode(node);
    setConfigDataSource(node.config?.source || {
      type: 'fs',
      path: '',
    });
    setValidationErrors({}); // Clear any previous validation errors
  };

  const closeConfigModal = () => {
    setConfiguringNode(null);
    setValidationErrors({}); // Clear validation errors when closing
  };

  const saveNodeConfiguration = async () => {
    if (!configuringNode) return;

    // Validate configuration
    const errors: Record<string, string> = {};

    // Validate title
    const titleError = validators.required(configuringNode.title);
    if (titleError) {
      errors.title = titleError;
    }

    // Validate data source configuration
    if (configuringNode.type === 'data') {
      if (configDataSource.type === 'fs') {
        const pathError = validators.required(configDataSource.path);
        if (pathError) {
          errors.path = 'Folder path is required';
        }
      } else if (configDataSource.type === 'http') {
        const urlError = validators.url(configDataSource.url || '');
        if (urlError) {
          errors.url = urlError;
        }
      } else if (configDataSource.type === 's3') {
        const urlError = validators.required(configDataSource.url);
        if (urlError) {
          errors.url = 'S3 URL is required';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    const updatedNode: CanvasNode = {
      ...configuringNode,
      title: sanitizers.trim(configuringNode.title),
      config: {
        ...configuringNode.config,
        source: configDataSource,
      },
    };

    await updateNode(updatedNode);
    closeConfigModal();
  };

  const previewNode = async (node: CanvasNode) => {
    setPreviewingNode(node);
    setPreviewData(null);

    try {
      if (node.type === 'data' && node.config?.source) {
        // Preview data source
        const data = await DataSourceService.readData(node.config.source);
        setPreviewData(data);
      } else {
        // For other node types, show the node data
        setPreviewData(node.data);
      }
    } catch (error) {
      console.error('Failed to preview node:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setPreviewData({ 
        error: `Failed to load ${node.type} node preview: ${errorMessage}` 
      });
    }
  };

  const selectFolder = async () => {
    try {
      const folderPath = await DataSourceService.selectFolder();
      if (folderPath) {
        setConfigDataSource({ ...configDataSource, path: folderPath });
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Loading canvas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 relative">
      {/* Canvas Toolbar */}
      <div className="bg-card border-b border-border px-6 py-4 flex gap-3 items-center shadow-sm">
        {/* Workflow Phase Indicator - Shows user progress */}
        {nodes.length > 0 && (
          <div className="flex items-center gap-2 pr-4 border-r border-border">
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg border border-primary/20">
              {workflowPhase === 'setup' && (
                <>
                  <Workflow className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-primary">Setup</span>
                </>
              )}
              {workflowPhase === 'explore' && (
                <>
                  <FileInput className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Explore</span>
                </>
              )}
              {workflowPhase === 'analyze' && (
                <>
                  <Cog className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">Analyze</span>
                </>
              )}
              {workflowPhase === 'export' && (
                <>
                  <FileOutput className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">Export</span>
                </>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-3 pr-3 border-r border-border">
          <select
            value={selectedNodeType}
            onChange={(e) => setSelectedNodeType(e.target.value as any)}
            className="px-4 py-2.5 border border-input bg-background text-foreground rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm hover:bg-accent transition-colors cursor-pointer"
            aria-label="Select node type"
          >
            <option value="data">📊 Data Source</option>
            <option value="agent">🤖 Agent</option>
            <option value="transform">⚙️ Transform</option>
            <option value="output">📤 Output</option>
          </select>
          <Button size="default" onClick={addNode} className="font-semibold shadow-sm hover:shadow-md transition-shadow">
            <Plus className="h-4 w-4 mr-2" />
            Add Node
          </Button>
          <Button size="default" variant="outline" onClick={multiAddNodes} className="font-semibold shadow-sm hover:shadow-md transition-shadow" disabled={nodes.length === 0}>
            Multi-Add
          </Button>
        </div>
        <Button size="default" variant="destructive" onClick={batchDelete} className="font-semibold shadow-sm hover:shadow-md transition-shadow" disabled={nodes.length === 0}>
          Clear All
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg border border-border">
            {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
          </span>
        </div>
      </div>

      {/* Floating Quick-Add Button - Primary workflow optimization */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-center pointer-events-auto animate-in fade-in zoom-in duration-500">
            <div className="mb-6">
              <div className="inline-block p-6 bg-primary/10 rounded-full mb-4">
                <Plus className="h-16 w-16 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-foreground">Start Your Workflow</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Add your first node to begin exploring data with AI agents
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button 
                size="lg" 
                onClick={() => {
                  setSelectedNodeType('data');
                  addNode();
                }}
                className="font-bold shadow-xl hover:shadow-2xl transition-all text-base h-14 px-8"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Data Source
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => {
                  setSelectedNodeType('agent');
                  addNode();
                }}
                className="font-bold shadow-lg hover:shadow-xl transition-all text-base h-14 px-8"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Agent
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Next Steps Guide - Shows after first node added */}
      {nodes.length > 0 && nodes.length <= 2 && !nodes.some(n => n.config?.source) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto z-10 animate-in fade-in slide-in-from-top duration-300">
          <Card className="shadow-lg border-2 border-primary/20 bg-card/95 backdrop-blur">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold mb-1">Configure your nodes</p>
                <p className="text-xs text-muted-foreground">
                  Click the <Settings className="h-3 w-3 inline" /> icon above a node to set up its data source
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Close hint by configuring first node
                  if (nodes[0]) configureNode(nodes[0]);
                }}
                className="shrink-0"
              >
                Got it
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-50 dark:bg-slate-900"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(100,116,139,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(100,116,139,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px',
          }}
        >
          {nodes.map((node) => (
            <CanvasNodeComponent
              key={node.id}
              node={node}
              onUpdate={updateNode}
              onDelete={deleteNode}
              onDuplicate={duplicateNode}
              onConfigure={configureNode}
              onPreview={previewNode}
            />
          ))}
        </div>
      </div>

      {/* Configuration Sliding Panel - Keeps canvas context visible */}
      {configuringNode && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
            onClick={closeConfigModal}
          />
          {/* Sliding Panel */}
          <Card className="absolute top-0 right-0 bottom-0 w-full max-w-2xl shadow-2xl border-l-2 border-border animate-in slide-in-from-right duration-300 overflow-auto bg-card">
            <CardHeader className="space-y-2 pb-6 border-b-2 border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl font-bold">Configure {configuringNode.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    {configuringNode.type === 'data' && 'Set up your data source to start exploring'}
                    {configuringNode.type === 'agent' && 'Configure AI agent to analyze your data'}
                    {configuringNode.type === 'transform' && 'Define data transformation rules'}
                    {configuringNode.type === 'output' && 'Choose output format and destination'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 w-10 p-0 hover:bg-accent rounded-lg transition-colors"
                  onClick={closeConfigModal}
                  aria-label="Close"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 pb-6">
              <div className="space-y-3">
                <label className="text-sm font-bold leading-none block">Node Title</label>
                <Input
                  value={configuringNode.title}
                  onChange={(e) => {
                    setConfiguringNode({ ...configuringNode, title: e.target.value });
                    if (validationErrors.title) {
                      setValidationErrors({ ...validationErrors, title: '' });
                    }
                  }}
                  placeholder="Enter node title"
                  className={`text-base ${validationErrors.title ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
                {validationErrors.title && (
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{validationErrors.title}</span>
                  </div>
                )}
              </div>

              {configuringNode.type === 'data' && (
                <>
                  <div className="space-y-3">
                    <label className="text-sm font-bold leading-none block">Data Source Type</label>
                    <select
                      value={configDataSource.type}
                      onChange={(e) =>
                        setConfigDataSource({
                          ...configDataSource,
                          type: e.target.value as DataSource['type'],
                        })
                      }
                      className="w-full px-4 py-2.5 border border-input bg-background text-foreground rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm cursor-pointer hover:bg-accent transition-colors"
                    >
                      <option value="fs">📁 Filesystem</option>
                      <option value="http">🌐 HTTP/HTTPS</option>
                      <option value="s3">☁️ Amazon S3</option>
                      <option value="ftp">📡 FTP</option>
                      <option value="gdrive">📂 Google Drive</option>
                      <option value="smb">🖥️ SMB/CIFS</option>
                      <option value="webdav">🔗 WebDAV</option>
                      <option value="zip">📦 ZIP Archive</option>
                    </select>
                  </div>

                  {configDataSource.type === 'fs' && (
                    <div className="space-y-3">
                      <label className="text-sm font-bold leading-none block">Folder Path</label>
                      <div className="flex gap-2">
                        <Input
                          value={configDataSource.path || ''}
                          onChange={(e) => {
                            setConfigDataSource({ ...configDataSource, path: e.target.value });
                            if (validationErrors.path) {
                              setValidationErrors({ ...validationErrors, path: '' });
                            }
                          }}
                          placeholder="/path/to/folder"
                          className={`text-base font-mono ${validationErrors.path ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        <Button size="default" onClick={selectFolder} variant="outline" className="shrink-0 hover:bg-accent transition-colors">
                          <Folder className="h-4 w-4" />
                        </Button>
                      </div>
                      {validationErrors.path && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{validationErrors.path}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {(configDataSource.type === 'http' || configDataSource.type === 's3') && (
                    <div className="space-y-3">
                      <label className="text-sm font-bold leading-none block">URL</label>
                      <Input
                        value={configDataSource.url || ''}
                        onChange={(e) => {
                          setConfigDataSource({ ...configDataSource, url: e.target.value });
                          if (validationErrors.url) {
                            setValidationErrors({ ...validationErrors, url: '' });
                          }
                        }}
                        placeholder={
                          configDataSource.type === 'http'
                            ? 'https://api.example.com/data'
                            : 's3://bucket-name/key'
                        }
                        className={`text-base font-mono ${validationErrors.url ? 'border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {validationErrors.url && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{validationErrors.url}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {configDataSource.type === 'ftp' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">FTP URL</label>
                        <Input
                          value={configDataSource.url || ''}
                          onChange={(e) =>
                            setConfigDataSource({ ...configDataSource, url: e.target.value })
                          }
                          placeholder="ftp://ftp.example.com"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold">Username</label>
                          <Input
                            value={configDataSource.credentials?.username || ''}
                            onChange={(e) =>
                              setConfigDataSource({
                                ...configDataSource,
                                credentials: {
                                  ...configDataSource.credentials,
                                  username: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold">Password</label>
                          <Input
                            type="password"
                            value={configDataSource.credentials?.password || ''}
                            onChange={(e) =>
                              setConfigDataSource({
                                ...configDataSource,
                                credentials: {
                                  ...configDataSource.credentials,
                                  password: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-6 border-t-2 border-border">
                <Button onClick={saveNodeConfiguration} className="flex-1 font-bold shadow-sm hover:shadow-md transition-shadow text-base h-11">
                  Save Configuration
                </Button>
                <Button
                  variant="outline"
                  onClick={closeConfigModal}
                  className="font-bold shadow-sm hover:shadow-md transition-shadow text-base h-11 px-6"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {previewingNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[700px] max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Preview: {previewingNode.title}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPreviewingNode(null);
                    setPreviewData(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {previewData === null ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading preview...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm">
                    <span className="font-medium">Type:</span> {previewingNode.type}
                  </div>
                  
                  {previewData.error ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
                      <div className="font-medium text-red-800 dark:text-red-200">Error</div>
                      <div className="text-sm text-red-600 dark:text-red-300">{previewData.error}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium mb-2">Data:</div>
                      <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded text-xs overflow-auto max-h-96">
                        {JSON.stringify(previewData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
