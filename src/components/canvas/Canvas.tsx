import React, { useState, useEffect } from 'react';
import { CanvasNode, DataSource } from '@/types';
import { CanvasNodeComponent } from './CanvasNode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Folder, AlertCircle } from 'lucide-react';
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
    <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Canvas Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-b border-border p-2 flex gap-2 items-center">
        <select
          value={selectedNodeType}
          onChange={(e) => setSelectedNodeType(e.target.value as any)}
          className="px-3 py-1 border border-input bg-background text-foreground rounded text-sm"
        >
          <option value="data">Data Source</option>
          <option value="agent">Agent</option>
          <option value="transform">Transform</option>
          <option value="output">Output</option>
        </select>
        <Button size="sm" onClick={addNode}>
          <Plus className="h-4 w-4 mr-1" />
          Add Node
        </Button>
        <Button size="sm" variant="outline" onClick={multiAddNodes}>
          Multi-Add
        </Button>
        <Button size="sm" variant="destructive" onClick={batchDelete}>
          Clear All
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {nodes.length} nodes
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-100 dark:bg-slate-950"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(100,116,139,0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(100,116,139,0.15) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
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

      {/* Configuration Modal */}
      {configuringNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[500px] max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Configure {configuringNode.title}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={closeConfigModal}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Node Title</label>
                <Input
                  value={configuringNode.title}
                  onChange={(e) => {
                    setConfiguringNode({ ...configuringNode, title: e.target.value });
                    if (validationErrors.title) {
                      setValidationErrors({ ...validationErrors, title: '' });
                    }
                  }}
                  placeholder="Node title"
                  className={validationErrors.title ? 'border-red-500' : ''}
                />
                {validationErrors.title && (
                  <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.title}
                  </div>
                )}
              </div>

              {configuringNode.type === 'data' && (
                <>
                  <div>
                    <label className="text-sm font-medium">Data Source Type</label>
                    <select
                      value={configDataSource.type}
                      onChange={(e) =>
                        setConfigDataSource({
                          ...configDataSource,
                          type: e.target.value as DataSource['type'],
                        })
                      }
                      className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded text-sm"
                    >
                      <option value="fs">Filesystem</option>
                      <option value="http">HTTP/HTTPS</option>
                      <option value="s3">Amazon S3</option>
                      <option value="ftp">FTP</option>
                      <option value="gdrive">Google Drive</option>
                      <option value="smb">SMB/CIFS</option>
                      <option value="webdav">WebDAV</option>
                      <option value="zip">ZIP Archive</option>
                    </select>
                  </div>

                  {configDataSource.type === 'fs' && (
                    <div>
                      <label className="text-sm font-medium">Folder Path</label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={configDataSource.path || ''}
                          onChange={(e) => {
                            setConfigDataSource({ ...configDataSource, path: e.target.value });
                            if (validationErrors.path) {
                              setValidationErrors({ ...validationErrors, path: '' });
                            }
                          }}
                          placeholder="/path/to/folder"
                          className={validationErrors.path ? 'border-red-500' : ''}
                        />
                        <Button size="sm" onClick={selectFolder}>
                          <Folder className="h-4 w-4" />
                        </Button>
                      </div>
                      {validationErrors.path && (
                        <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors.path}
                        </div>
                      )}
                    </div>
                  )}

                  {(configDataSource.type === 'http' || configDataSource.type === 's3') && (
                    <div>
                      <label className="text-sm font-medium">URL</label>
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
                        className={validationErrors.url ? 'border-red-500' : ''}
                      />
                      {validationErrors.url && (
                        <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors.url}
                        </div>
                      )}
                    </div>
                  )}

                  {configDataSource.type === 'ftp' && (
                    <>
                      <div>
                        <label className="text-sm font-medium">FTP URL</label>
                        <Input
                          value={configDataSource.url || ''}
                          onChange={(e) =>
                            setConfigDataSource({ ...configDataSource, url: e.target.value })
                          }
                          placeholder="ftp://ftp.example.com"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium">Username</label>
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
                        <div>
                          <label className="text-sm font-medium">Password</label>
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

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={saveNodeConfiguration} className="flex-1">
                  Save Configuration
                </Button>
                <Button
                  variant="outline"
                  onClick={closeConfigModal}
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
