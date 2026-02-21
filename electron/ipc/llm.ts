import { ipcMain } from 'electron';
import type { LLMConfig, LLMMessage } from '../../src/types/index';
import { LLMClient } from '../services/llmClient';

const client = new LLMClient();

export function registerLLMHandlers(): void {
  ipcMain.handle(
    'llm:testConnection',
    async (_event, config: LLMConfig): Promise<boolean> => {
      return client.testConnection(config);
    },
  );

  ipcMain.handle(
    'llm:sendMessage',
    async (_event, messages: LLMMessage[], config: LLMConfig): Promise<string> => {
      return client.sendMessage(messages, config);
    },
  );

  ipcMain.handle('llm:abort', async (): Promise<void> => {
    client.abortCurrentRequest();
  });
}
