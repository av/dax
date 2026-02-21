import { ipcMain } from 'electron';
import { LLMClient } from '../services/llmClient';
const client = new LLMClient();
export function registerLLMHandlers() {
    ipcMain.handle('llm:testConnection', async (_event, config) => {
        return client.testConnection(config);
    });
    ipcMain.handle('llm:sendMessage', async (_event, messages, config) => {
        return client.sendMessage(messages, config);
    });
    ipcMain.handle('llm:abort', async () => {
        client.abortCurrentRequest();
    });
}
