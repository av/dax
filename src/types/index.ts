export interface CanvasNode {
  id: string;
  type: 'data' | 'agent' | 'transform' | 'output';
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Record<string, any>;
  config?: NodeConfig;
}

export interface NodeConfig {
  source?: DataSource;
  agent?: AgentConfig;
  preview?: boolean;
  [key: string]: any;
}

export interface DataSource {
  type: 'fs' | 'http' | 's3' | 'ftp' | 'gdrive' | 'smb' | 'webdav' | 'zip';
  url?: string;
  path?: string;
  credentials?: Record<string, string>;
  options?: Record<string, any>;
}

export interface AgentConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AgentTool[];
  systemPrompt?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  type: 'read_canvas' | 'write_canvas' | 'query_rdf' | 'extract_data' | 'custom';
  config?: Record<string, any>;
}

export interface RDFEntity {
  id: string;
  type: string;
  attributes: Record<string, any>;
  links: RDFLink[];
}

export interface RDFLink {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, any>;
}

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  autostart: boolean;
  dataDir: string;
  backup: {
    enabled: boolean;
    interval: number;
    location: string;
  };
  sync: {
    enabled: boolean;
    provider?: string;
    config?: Record<string, any>;
  };
  language: string;
  hotkeys: Record<string, string>;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: string[];
}

export interface ACLEntry {
  resourceId: string;
  userId: string;
  permissions: ('read' | 'write' | 'delete' | 'share')[];
}
