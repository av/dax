import React, { useState, useEffect } from 'react';
import { CanvasNode } from '@/types';
import { CanvasNodeComponent } from './CanvasNode';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { getDatabaseInstance } from '@/services/database';

const CURRENT_USER_ID = 'admin'; // In a real app, this would come from auth context

export const Canvas: React.FC = () => {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [selectedNodeType, setSelectedNodeType] = useState<'data' | 'agent' | 'transform' | 'output'>('data');
  const [isLoading, setIsLoading] = useState(true);

  // Load nodes from database on mount
  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      const db = getDatabaseInstance();
      const loadedNodes = await db.getCanvasNodes(CURRENT_USER_ID);
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
      await db.saveCanvasNode(newNode, CURRENT_USER_ID);
      setNodes([...nodes, newNode]);
    } catch (error) {
      console.error('Failed to add node:', error);
    }
  };

  const updateNode = async (updatedNode: CanvasNode) => {
    try {
      const db = getDatabaseInstance();
      await db.saveCanvasNode(updatedNode, CURRENT_USER_ID);
      setNodes(nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  };

  const deleteNode = async (id: string) => {
    try {
      const db = getDatabaseInstance();
      await db.deleteCanvasNode(id, CURRENT_USER_ID);
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
      await db.saveCanvasNode(newNode, CURRENT_USER_ID);
      setNodes([...nodes, newNode]);
    } catch (error) {
      console.error('Failed to duplicate node:', error);
    }
  };

  const batchDelete = async () => {
    try {
      const db = getDatabaseInstance();
      // Delete all nodes from database
      await Promise.all(nodes.map(node => db.deleteCanvasNode(node.id, CURRENT_USER_ID)));
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
      // Save all duplicated nodes to database
      await Promise.all(duplicatedNodes.map(node => db.saveCanvasNode(node, CURRENT_USER_ID)));
      setNodes([...nodes, ...duplicatedNodes]);
    } catch (error) {
      console.error('Failed to multi-add nodes:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Loading canvas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Canvas Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b p-2 flex gap-2 items-center">
        <select
          value={selectedNodeType}
          onChange={(e) => setSelectedNodeType(e.target.value as any)}
          className="px-3 py-1 border rounded text-sm"
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
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
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
            />
          ))}
        </div>
      </div>
    </div>
  );
};
