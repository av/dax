import { DataSource } from '@/types';

// Unified file system interface for all data sources
export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  modified?: string;
  created?: string;
}

export interface FileSystemInterface {
  // Directory operations
  readDir(path: string): Promise<FileSystemEntry[]>;

  // File operations
  readFile(path: string, encoding?: string): Promise<string>;
  readFileBuffer(path: string): Promise<ArrayBuffer>;

  // Metadata operations
  stat(path: string): Promise<FileSystemEntry>;
  exists(path: string): Promise<boolean>;

  // Connection info
  getBasePath(): string;
  getType(): string;
}

// Filesystem implementation
class LocalFilesystem implements FileSystemInterface {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async readDir(dirPath: string): Promise<FileSystemEntry[]> {
    if (!window.electron?.fs) {
      throw new Error('Filesystem API not available');
    }

    const fullPath = dirPath || this.basePath;
    const entries = await window.electron.fs.readDir(fullPath);
    return entries.map((entry: any) => ({
      name: entry.name,
      path: entry.path,
      isDirectory: entry.isDirectory,
      isFile: entry.isFile,
    }));
  }

  async readFile(filePath: string, encoding: string = 'utf-8'): Promise<string> {
    if (!window.electron?.fs) {
      throw new Error('Filesystem API not available');
    }

    return await window.electron.fs.readFile(filePath, encoding);
  }

  async readFileBuffer(filePath: string): Promise<ArrayBuffer> {
    if (!window.electron?.fs) {
      throw new Error('Filesystem API not available');
    }

    const arrayData = await window.electron.fs.readFileBuffer(filePath);
    return new Uint8Array(arrayData).buffer;
  }

  async stat(filePath: string): Promise<FileSystemEntry> {
    if (!window.electron?.fs) {
      throw new Error('Filesystem API not available');
    }

    const stats = await window.electron.fs.stat(filePath);
    return {
      name: filePath.split('/').pop() || '',
      path: filePath,
      isDirectory: stats.isDirectory,
      isFile: stats.isFile,
      size: stats.size,
      modified: stats.modified,
      created: stats.created,
    };
  }

  async exists(filePath: string): Promise<boolean> {
    if (!window.electron?.fs) {
      throw new Error('Filesystem API not available');
    }

    return await window.electron.fs.exists(filePath);
  }

  getBasePath(): string {
    return this.basePath;
  }

  getType(): string {
    return 'fs';
  }
}

// Main DataSource service
export class DataSourceService {
  private static connections: Map<string, FileSystemInterface> = new Map();

  /**
   * Select a local folder using native dialog
   */
  static async selectFolder(): Promise<string | null> {
    if (!window.electron?.fs) {
      throw new Error('Filesystem API not available');
    }

    return await window.electron.fs.selectFolder();
  }

  /**
   * Connect to a data source and return a filesystem interface
   */
  static async connect(source: DataSource): Promise<FileSystemInterface> {
    switch (source.type) {
      case 'fs':
        return this.connectFilesystem(source);
      case 'http':
        throw new Error('HTTP data source not yet implemented with FS interface');
      case 's3':
        throw new Error('S3 data source not yet implemented');
      case 'ftp':
        throw new Error('FTP data source not yet implemented');
      case 'gdrive':
        throw new Error('Google Drive data source not yet implemented');
      case 'smb':
        throw new Error('SMB data source not yet implemented');
      case 'webdav':
        throw new Error('WebDAV data source not yet implemented');
      case 'zip':
        throw new Error('ZIP data source not yet implemented');
      default:
        throw new Error(`Unknown source type: ${source.type}`);
    }
  }

  private static async connectFilesystem(source: DataSource): Promise<FileSystemInterface> {
    if (!source.path) {
      throw new Error('Filesystem path is required');
    }

    console.log('Connecting to filesystem:', source.path);

    // Verify path exists
    if (!window.electron?.fs) {
      throw new Error('Filesystem API not available');
    }

    const exists = await window.electron.fs.exists(source.path);
    if (!exists) {
      throw new Error(`Path does not exist: ${source.path}`);
    }

    const fs = new LocalFilesystem(source.path);

    // Store connection for reuse
    const connectionId = `fs:${source.path}`;
    this.connections.set(connectionId, fs);

    return fs;
  }

  /**
   * Get an existing connection
   */
  static getConnection(connectionId: string): FileSystemInterface | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * List all active connections
   */
  static getConnections(): Map<string, FileSystemInterface> {
    return this.connections;
  }

  /**
   * Disconnect and remove a connection
   */
  static disconnect(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * Legacy method for backward compatibility
   */
  static async readData(source: DataSource): Promise<any> {
    const fs = await this.connect(source);
    const entries = await fs.readDir(fs.getBasePath());

    return {
      type: source.type,
      basePath: fs.getBasePath(),
      entries: entries,
      metadata: {
        totalEntries: entries.length,
        directories: entries.filter(e => e.isDirectory).length,
        files: entries.filter(e => e.isFile).length,
      },
    };
  }
}
