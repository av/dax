import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { CanvasNode } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, Settings, Copy, Eye } from 'lucide-react';

interface CanvasNodeComponentProps {
  node: CanvasNode;
  onUpdate: (node: CanvasNode) => void;
  onDelete: (id: string) => void;
  onDuplicate: (node: CanvasNode) => void;
}

export const CanvasNodeComponent: React.FC<CanvasNodeComponentProps> = ({
  node,
  onUpdate,
  onDelete,
  onDuplicate,
}) => {
  const [showToolbar, setShowToolbar] = useState(false);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'data':
        return 'bg-blue-100 border-blue-300';
      case 'agent':
        return 'bg-green-100 border-green-300';
      case 'transform':
        return 'bg-purple-100 border-purple-300';
      case 'output':
        return 'bg-orange-100 border-orange-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <Rnd
      size={{ width: node.width, height: node.height }}
      position={{ x: node.x, y: node.y }}
      onDragStop={(e, d) => {
        onUpdate({ ...node, x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate({
          ...node,
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          ...position,
        });
      }}
      bounds="parent"
      className={`rounded-lg border-2 ${getNodeColor(node.type)} shadow-lg`}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      <div className="h-full flex flex-col p-2">
        {/* Toolbar */}
        {showToolbar && (
          <div className="absolute -top-10 left-0 right-0 flex justify-center gap-1 z-10">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDuplicate(node)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary">
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary">
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(node.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Node Header */}
        <div className="font-semibold text-sm mb-2 border-b pb-1">
          {node.title}
        </div>

        {/* Node Content */}
        <div className="flex-1 overflow-auto text-xs">
          <div className="space-y-1">
            <div>Type: {node.type}</div>
            {node.config?.source && (
              <div>Source: {node.config.source.type}</div>
            )}
            {node.config?.agent && (
              <div>Agent: {node.config.agent.provider}</div>
            )}
          </div>
        </div>
      </div>
    </Rnd>
  );
};
