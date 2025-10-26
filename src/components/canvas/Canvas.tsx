import React, { useState, useEffect } from 'react';
import { CanvasNode, DataSource } from '@/types';
import { CanvasNodeComponent } from './CanvasNode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Folder } from 'lucide-react';
import { getDatabaseInstance } from '@/services/database';
import { DataSourceService } from '@/services/dataSource';

// Single-user desktop app - always use admin user with full access
const USER_ID = 'admin';

export const Canvas: React.FC = () => {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [selectedNodeType, setSelectedNodeType] = useState<'data' | 'agent' | 'transform' | 'output'>('data');
  const [isLoading, setIsLoading] = useState(true);
  const [configuringNode, setConfiguringNode] = useState<CanvasNode | null>(null);
  const [configDataSource, setConfigDataSource] = useState<DataSource>({
    type: 'fs',
    path: '',
  });

  // Load nodes from database on mount
  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      const db = getDatabaseInstance();
      const loadedNodes = await db.getCanvasNodes(USER_ID);
      setNodes(loadedNodes);
    } catch (error) {
      console.error('Failed to load canvas nodes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addNode = async () => {
    const newNode: CanvasNode = {
      id: `node-${Date.now()}`,
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
      await db.saveCanvasNode(newNode, USER_ID);
      setNodes([...nodes, newNode]);
    } catch (error) {
      console.error('Failed to add node:', error);
    }
  };

  const updateNode = async (updatedNode: CanvasNode) => {
    try {
      const db = getDatabaseInstance();
      await db.saveCanvasNode(updatedNode, USER_ID);
      setNodes(nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  };

  const deleteNode = async (id: string) => {
    try {
      const db = getDatabaseInstance();
      await db.deleteCanvasNode(id, USER_ID);
      setNodes(nodes.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  const duplicateNode = async (node: CanvasNode) => {
    const newNode: CanvasNode = {
      ...node,
      id: `node-${Date.now()}`,
      x: node.x + 20,
      y: node.y + 20,
    };

    try {
      const db = getDatabaseInstance();
      await db.saveCanvasNode(newNode, USER_ID);
      setNodes([...nodes, newNode]);
    } catch (error) {
      console.error('Failed to duplicate node:', error);
    }
  };

  const batchDelete = async () => {
    try {
      const db = getDatabaseInstance();
      // Delete all nodes from database
      await Promise.all(nodes.map(node => db.deleteCanvasNode(node.id, USER_ID)));
      setNodes([]);
    } catch (error) {
      console.error('Failed to delete all nodes:', error);
    }
  };

  const multiAddNodes = async () => {
    if (nodes.length === 0) {
      return;
    }

    const duplicatedNodes = nodes.map(n => ({
      ...n,
      id: `node-${Date.now()}-${Math.random()}`,
      x: n.x + 30,
      y: n.y + 30,
    }));

    try {
      const db = getDatabaseInstance();
      await Promise.all(duplicatedNodes.map(node => db.saveCanvasNode(node, USER_ID)));
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
  };

  const saveNodeConfiguration = async () => {
    if (!configuringNode) return;

    const updatedNode: CanvasNode = {
      ...configuringNode,
      config: {
        ...configuringNode.config,
        source: configDataSource,
      },
    };

    await updateNode(updatedNode);
    setConfiguringNode(null);
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
                  onClick={() => setConfiguringNode(null)}
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
                  onChange={(e) =>
                    setConfiguringNode({ ...configuringNode, title: e.target.value })
                  }
                  placeholder="Node title"
                />
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
                          onChange={(e) =>
                            setConfigDataSource({ ...configDataSource, path: e.target.value })
                          }
                          placeholder="/path/to/folder"
                        />
                        <Button size="sm" onClick={selectFolder}>
                          <Folder className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {(configDataSource.type === 'http' || configDataSource.type === 's3') && (
                    <div>
                      <label className="text-sm font-medium">URL</label>
                      <Input
                        value={configDataSource.url || ''}
                        onChange={(e) =>
                          setConfigDataSource({ ...configDataSource, url: e.target.value })
                        }
                        placeholder={
                          configDataSource.type === 'http'
                            ? 'https://api.example.com/data'
                            : 's3://bucket-name/key'
                        }
                      />
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
                  onClick={() => setConfiguringNode(null)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
