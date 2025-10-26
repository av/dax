import React, { useState } from 'react';
import { CanvasNode } from '@/types';
import { CanvasNodeComponent } from './CanvasNode';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const Canvas: React.FC = () => {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [selectedNodeType, setSelectedNodeType] = useState<'data' | 'agent' | 'transform' | 'output'>('data');

  const addNode = () => {
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
    setNodes([...nodes, newNode]);
  };

  const updateNode = (updatedNode: CanvasNode) => {
    setNodes(nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
  };

  const deleteNode = (id: string) => {
    setNodes(nodes.filter((n) => n.id !== id));
  };

  const duplicateNode = (node: CanvasNode) => {
    const newNode: CanvasNode = {
      ...node,
      id: `node-${Date.now()}`,
      x: node.x + 20,
      y: node.y + 20,
    };
    setNodes([...nodes, newNode]);
  };

  const batchDelete = () => {
    if (confirm('Delete all nodes?')) {
      setNodes([]);
    }
  };

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
        <Button size="sm" variant="outline" onClick={() => setNodes([...nodes, ...nodes.map(n => ({ ...n, id: `node-${Date.now()}-${Math.random()}`, x: n.x + 30, y: n.y + 30 }))])}>
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
