import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface FileMetadata {
  path: string;
  name: string;
  extension: string;
  sizeBytes: number;
  mimeType: string;
  isReadable: boolean;
  isWritable: boolean;
  lastModified: number;
  category: string;
}

export interface FileContent {
  text?: string;
  binary?: number[];
  encoding: string;
}

export interface FileChangeEvent {
  path: string;
  changeType: 'modified' | 'removed' | 'created';
  newPath?: string;
}

export async function getFileMetadata(path: string): Promise<FileMetadata> {
  return invoke<FileMetadata>('get_file_metadata', { path });
}

export async function readFile(path: string): Promise<FileContent> {
  return invoke<FileContent>('read_file', { path });
}

export async function writeFile(
  path: string,
  content: string,
  createDirs = false
): Promise<void> {
  return invoke('write_file', { path, content, createDirs });
}

export async function saveFile(path: string, content: string): Promise<void> {
  return invoke('save_file', { path, content });
}

export async function watchFile(path: string): Promise<void> {
  return invoke('watch_file', { path });
}

export async function unwatchFile(path: string): Promise<void> {
  return invoke('unwatch_file', { path });
}

export interface TauriEventPayloads {
  'file-changed': FileChangeEvent;
  'file-deleted': { id: string; path: string };
}

export function listenToEvent<K extends keyof TauriEventPayloads>(
  event: K,
  handler: (payload: TauriEventPayloads[K]) => void
): Promise<UnlistenFn> {
  return listen<TauriEventPayloads[K]>(event, (e) => handler(e.payload));
}

export function emitToBackend<T>(event: string, payload: T): Promise<void> {
  return emit(event, payload);
}

export { invoke };
