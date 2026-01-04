import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { X } from 'lucide-react';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-[500px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>About DAX</CardTitle>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">DAX - Data Agent eXplorer</h2>
            <p className="text-sm text-muted-foreground">Version 1.0.0</p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm">
              A powerful canvas-based data exploration application with AI agent integration.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Features</h3>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Interactive canvas with draggable & resizable nodes</li>
              <li>Multiple data sources (Filesystem, HTTP/HTTPS, S3, FTP, etc.)</li>
              <li>AI Agent integration (OpenAI, Anthropic, Custom APIs)</li>
              <li>RDF/Knowledge Graph for structured data</li>
              <li>Turso DB for persistent storage</li>
              <li>Customizable preferences and themes</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Technology Stack</h3>
            <p className="text-sm text-muted-foreground">
              Built with Electron, React 19, TypeScript, Tailwind CSS v4, and shadcn/ui
            </p>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              © 2026 DAX - Licensed under ISC License
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
