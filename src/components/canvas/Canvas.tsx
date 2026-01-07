import React, { useState, useEffect, useCallback } from 'react';
import { CanvasNode, DataSource } from '@/types';
import { CanvasNodeComponent } from './CanvasNode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Folder, AlertCircle, Workflow, FileInput, Cog, FileOutput, Settings, CheckCircle2 } from 'lucide-react';
import { getDatabaseInstance } from '@/services/database';
import { DataSourceService } from '@/services/dataSource';
import { validators, sanitizers } from '@/lib/validation';
import { DEFAULT_USER_ID } from '@/lib/constants';
import { generateUUID } from '@/lib/utils';

// Toast notification component for better feedback
const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'info'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-primary';
  const ariaRole = type === 'error' ? 'alert' : 'status';
  const ariaLive = type === 'error' ? 'assertive' : 'polite';
  
  return (
    <div 
      className={`fixed bottom-6 right-6 ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 z-50 flex items-center gap-3 max-w-md`}
      role={ariaRole}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      {type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0" />}
      {type === 'error' && <AlertCircle className="h-5 w-5 shrink-0" />}
      {type === 'info' && <Settings className="h-5 w-5 shrink-0" />}
      <span className="font-semibold">{message}</span>
      <button onClick={onClose} className="ml-auto hover:opacity-70 transition-opacity" aria-label="Close notification">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  }, []);

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

  const loadNodes = useCallback(async (isMounted: () => boolean = () => true) => {
    try {
      const db = getDatabaseInstance();
      const loadedNodes = await db.getCanvasNodes(DEFAULT_USER_ID);
      if (isMounted()) {
        setNodes(loadedNodes);
      }
    } catch (error) {
      console.error('Failed to load canvas nodes:', error);
    } finally {
      if (isMounted()) {
        setIsLoading(false);
      }
    }
  }, []);

  const closeConfigModal = useCallback(() => {
    setConfiguringNode(null);
    setValidationErrors({}); // Clear validation errors when closing
  }, []);

  const saveNodeConfiguration = useCallback(async () => {
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
      showToast('Please fix validation errors', 'error');
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

    try {
      const db = getDatabaseInstance();
      await db.saveCanvasNode(updatedNode, DEFAULT_USER_ID);
      setNodes(nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
      closeConfigModal();
      showToast('Configuration saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save node configuration:', error);
      showToast('Failed to save configuration', 'error');
    }
  }, [configuringNode, configDataSource, nodes, showToast, closeConfigModal]);

  const addNode = useCallback(async () => {
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
      showToast(`${newNode.title} added`, 'success');
    } catch (error) {
      console.error('Failed to add node:', error);
      showToast('Failed to add node', 'error');
    }
  }, [selectedNodeType, nodes, showToast]);

  // Load nodes from database on mount
  useEffect(() => {
    let isMounted = true;
    const checkMounted = () => isMounted;
    loadNodes(checkMounted);
    return () => {
      isMounted = false;
    };
  }, [loadNodes]);

  // Listen for canvas-cleared event to refresh nodes
  useEffect(() => {
    let isMounted = true;
    const checkMounted = () => isMounted;
    
    const handleCanvasCleared = () => {
      loadNodes(checkMounted);
    };

    window.addEventListener('canvas-cleared', handleCanvasCleared);
    return () => {
      isMounted = false;
      window.removeEventListener('canvas-cleared', handleCanvasCleared);
    };
  }, [loadNodes]);

  // Keyboard shortcuts for better accessibility and power user support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: Add new node (works globally except when typing)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
        if (!isTyping) {
          e.preventDefault();
          addNode();
        }
      }

      // Cmd/Ctrl + S: Save configuration if panel is open (works even when typing in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && configuringNode) {
        e.preventDefault();
        saveNodeConfiguration();
      }

      // Escape: Close configuration panel or preview (works globally)
      if (e.key === 'Escape') {
        if (configuringNode) {
          closeConfigModal();
        }
        if (previewingNode) {
          setPreviewingNode(null);
          setPreviewData(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [configuringNode, previewingNode, addNode, saveNodeConfiguration, closeConfigModal]);

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
      showToast('Node deleted', 'info');
    } catch (error) {
      console.error('Failed to delete node:', error);
      showToast('Failed to delete node', 'error');
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
      showToast('Node duplicated', 'success');
    } catch (error) {
      console.error('Failed to duplicate node:', error);
      showToast('Failed to duplicate node', 'error');
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
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="inline-block p-6 bg-primary/10 rounded-full mb-4 animate-pulse">
            <svg className="h-12 w-12 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <div className="text-base font-semibold text-foreground mb-1">Loading Your Workspace</div>
          <div className="text-sm text-muted-foreground">Preparing canvas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background relative">
      {/* Canvas Toolbar */}
      <div className="bg-card border-b-2 border-border px-6 py-4 flex gap-3 items-center shadow-md z-10">
        {/* Workflow Phase Indicator - Enhanced prominence */}
        {nodes.length > 0 && (
          <div className="flex items-center gap-2 pr-4 border-r-2 border-border">
            <div className="flex items-center gap-3 bg-primary/15 px-4 py-2.5 rounded-xl border-2 border-primary/30 shadow-sm transition-all duration-300">
              <div className="flex items-center gap-2 animate-fade-in">
              {workflowPhase === 'setup' && (
                <>
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <Workflow className="h-5 w-5 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Step 1</span>
                    <span className="text-sm font-bold text-primary">Setup</span>
                  </div>
                </>
              )}
              {workflowPhase === 'explore' && (
                <>
                  <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                  <FileInput className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Step 2</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Explore Data</span>
                  </div>
                </>
              )}
              {workflowPhase === 'analyze' && (
                <>
                  <div className="h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse" />
                  <Cog className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Step 3</span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">Analyze</span>
                  </div>
                </>
              )}
              {workflowPhase === 'export' && (
                <>
                  <div className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400 animate-pulse" />
                  <FileOutput className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Step 4</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">Export Results</span>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-3 pr-4 border-r-2 border-border">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add Node</label>
          <select
            value={selectedNodeType}
            onChange={(e) => setSelectedNodeType(e.target.value as any)}
            className="px-4 py-2.5 border-2 border-input bg-background text-foreground rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm hover:bg-accent transition-colors cursor-pointer"
            aria-label="Select node type"
          >
            <option value="data">📊 Data Source</option>
            <option value="agent">🤖 Agent</option>
            <option value="transform">⚙️ Transform</option>
            <option value="output">📤 Output</option>
          </select>
          <Button size="default" onClick={addNode} className="font-bold shadow-md hover:shadow-lg transition-all h-11 px-6 group relative">
            <Plus className="h-5 w-5 mr-2" />
            <span>Add Node</span>
            <kbd className="ml-2 px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity">
              ⌘N
            </kbd>
          </Button>
        </div>
        <Button size="default" variant="outline" onClick={multiAddNodes} className="font-semibold shadow-sm hover:shadow-md transition-shadow" disabled={nodes.length === 0}>
          Duplicate All
        </Button>
        <Button size="default" variant="destructive" onClick={batchDelete} className="font-semibold shadow-sm hover:shadow-md transition-shadow" disabled={nodes.length === 0}>
          Clear All
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Canvas</span>
            <span className="text-sm font-bold text-foreground">
              {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Quick-Add Button - Primary workflow optimization */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-center pointer-events-auto animate-in fade-in zoom-in duration-500">
            <div className="mb-8">
              <div className="inline-block p-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl mb-6 shadow-xl">
                <Plus className="h-20 w-20 text-primary" strokeWidth={2.5} />
              </div>
              <h3 className="text-3xl font-black mb-3 text-foreground tracking-tight">Start Your Workflow</h3>
              <p className="text-muted-foreground mb-2 max-w-md text-base leading-relaxed">
                Choose how you want to begin your data exploration journey
              </p>
              <p className="text-sm text-muted-foreground/70 max-w-md mb-4">
                Add a data source to connect your data, or start with an AI agent
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg max-w-sm mx-auto">
                <kbd className="px-2 py-1 bg-background rounded font-mono border">⌘N</kbd>
                <span>to quickly add a node</span>
              </div>
            </div>
            <div className="flex flex-col gap-4 items-center">
              {/* Primary Action - Data Source (recommended first step) */}
              <Button 
                size="lg" 
                onClick={() => {
                  setSelectedNodeType('data');
                  addNode();
                }}
                className="font-bold shadow-2xl hover:shadow-3xl transition-all text-lg h-16 px-10 bg-primary hover:bg-primary/90 rounded-2xl group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                <Plus className="h-6 w-6 mr-3" strokeWidth={3} />
                <div className="flex flex-col items-start">
                  <span>Add Data Source</span>
                  <span className="text-xs font-medium opacity-90">Recommended first step</span>
                </div>
              </Button>
              
              {/* Secondary Action - Agent */}
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => {
                  setSelectedNodeType('agent');
                  addNode();
                }}
                className="font-bold shadow-lg hover:shadow-xl transition-all text-base h-14 px-8 border-2 rounded-xl"
              >
                <Plus className="h-5 w-5 mr-2" />
                Start with an Agent
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Next Steps Guide - Non-intrusive tooltip style */}
      {nodes.length > 0 && nodes.length <= 2 && !nodes.some(n => n.config?.source) && (
        <div className="absolute top-4 right-4 pointer-events-auto z-10 animate-in fade-in slide-in-from-right duration-300 max-w-sm">
          <Card className="shadow-xl border-2 border-primary/30 bg-card backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 shadow-inner">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-2 text-foreground">💡 Next Step: Configure Your Node</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    Hover over the node and click the <Settings className="h-3 w-3 inline mx-0.5" /> icon to set up your data source
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      // Close hint by configuring first node
                      if (nodes[0]) configureNode(nodes[0]);
                    }}
                    className="text-xs h-8 px-3 font-semibold hover:bg-primary/10 rounded-lg"
                  >
                    Configure Now →
                  </Button>
                </div>
              </div>
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

      {/* Configuration Sliding Panel - Enhanced workflow guidance */}
      {configuringNode && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            onClick={closeConfigModal}
          />
          {/* Sliding Panel */}
          <Card className="absolute top-0 right-0 bottom-0 w-full max-w-2xl shadow-2xl border-l-4 border-primary/50 animate-in slide-in-from-right duration-300 overflow-auto bg-card">
            <CardHeader className="space-y-3 pb-6 border-b-2 border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-black">Configure Node</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium pl-[52px]">
                    {configuringNode.type === 'data' && '📊 Set up your data source to start exploring'}
                    {configuringNode.type === 'agent' && '🤖 Configure AI agent to analyze your data'}
                    {configuringNode.type === 'transform' && '⚙️ Define data transformation rules'}
                    {configuringNode.type === 'output' && '📤 Choose output format and destination'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 w-10 p-0 hover:bg-accent rounded-xl transition-colors"
                  onClick={closeConfigModal}
                  aria-label="Close"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-8 pb-8 px-8">
              {/* Step 1: Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
                    1
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Basic Information</h3>
                </div>
                <div className="space-y-3 pl-11">
                  <label className="text-sm font-bold leading-none block text-foreground">Node Title</label>
                  <Input
                    value={configuringNode.title}
                    onChange={(e) => {
                      setConfiguringNode({ ...configuringNode, title: e.target.value });
                      if (validationErrors.title) {
                        setValidationErrors({ ...validationErrors, title: '' });
                      }
                    }}
                    placeholder="Enter a descriptive name"
                    className={`text-base h-12 ${validationErrors.title ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {validationErrors.title && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{validationErrors.title}</span>
                    </div>
                  )}
                </div>
              </div>

              {configuringNode.type === 'data' && (
                <>
                  {/* Step 2: Data Source Configuration */}
                  <div className="space-y-4 border-t-2 border-border pt-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                        2
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Data Source Configuration</h3>
                    </div>
                    <div className="space-y-4 pl-11">
                      <div className="space-y-3">
                        <label className="text-sm font-bold leading-none block text-foreground">Source Type</label>
                        <select
                          value={configDataSource.type}
                          onChange={(e) =>
                            setConfigDataSource({
                              ...configDataSource,
                              type: e.target.value as DataSource['type'],
                            })
                          }
                          className="w-full px-4 py-3 border-2 border-input bg-background text-foreground rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm cursor-pointer hover:bg-accent transition-colors"
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
                      <label className="text-sm font-bold leading-none block text-foreground">Folder Path</label>
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <Input
                            value={configDataSource.path || ''}
                            onChange={(e) => {
                              setConfigDataSource({ ...configDataSource, path: e.target.value });
                              if (validationErrors.path) {
                                setValidationErrors({ ...validationErrors, path: '' });
                              }
                            }}
                            placeholder="e.g., /Users/username/Documents/data or C:\Users\username\Documents\data"
                            className={`text-base font-mono h-12 pr-10 ${validationErrors.path ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {configDataSource.path && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400">
                              <svg className="h-5 w-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <Button size="default" onClick={selectFolder} variant="outline" className="shrink-0 hover:bg-accent transition-colors h-12 w-12 p-0" title="Browse for folder">
                          <Folder className="h-5 w-5" />
                        </Button>
                      </div>
                      {validationErrors.path && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{validationErrors.path}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 flex items-start gap-2 bg-muted/30 px-3 py-2 rounded-lg">
                        <span className="shrink-0">💡</span>
                        <span>You can drag and drop a folder here, click the folder icon to browse, or paste the path directly</span>
                      </p>
                    </div>
                  )}

                  {(configDataSource.type === 'http' || configDataSource.type === 's3') && (
                    <div className="space-y-3">
                      <label className="text-sm font-bold leading-none block text-foreground">
                        {configDataSource.type === 'http' ? 'API Endpoint URL' : 'S3 Bucket URL'}
                      </label>
                      <div className="relative">
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
                              ? 'e.g., https://api.example.com/v1/data'
                              : 'e.g., s3://your-bucket-name/path/to/data'
                          }
                          className={`text-base font-mono h-12 pr-10 ${validationErrors.url ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {configDataSource.url && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400">
                            <svg className="h-5 w-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {validationErrors.url && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{validationErrors.url}</span>
                        </div>
                      )}
                      {configDataSource.type === 'http' && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-start gap-2 bg-muted/30 px-3 py-2 rounded-lg">
                          <span className="shrink-0">💡</span>
                          <span>Supports REST APIs and webhooks. Authentication can be configured below.</span>
                        </p>
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
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-4 pt-8 border-t-2 border-border sticky bottom-0 bg-card pb-2">
                <Button 
                  onClick={saveNodeConfiguration} 
                  className="flex-1 font-bold shadow-lg hover:shadow-xl transition-all text-base h-14 rounded-xl bg-primary hover:bg-primary/90 group"
                  disabled={!!Object.keys(validationErrors).length}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save Configuration</span>
                    <kbd className="ml-2 px-2 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                      ⌘S
                    </kbd>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={closeConfigModal}
                  className="font-bold shadow-sm hover:shadow-md transition-shadow text-base h-14 px-8 rounded-xl border-2 group"
                >
                  <span>Cancel</span>
                  <kbd className="ml-2 px-2 py-0.5 bg-muted rounded text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                    Esc
                  </kbd>
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

      {/* Toast Notifications for user feedback */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
