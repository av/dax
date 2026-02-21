import { contextBridge, ipcRenderer } from 'electron';
const api = {
    openFolder() {
        return ipcRenderer.invoke('dialog:openFolder');
    },
    readDirectory(path) {
        return ipcRenderer.invoke('fs:readDirectory', path);
    },
    statFile(path) {
        return ipcRenderer.invoke('fs:statFile', path);
    },
    readFileContent(path) {
        return ipcRenderer.invoke('fs:readFileContent', path);
    },
    readBinaryFile(path) {
        return ipcRenderer.invoke('fs:readBinaryFile', path);
    },
    writeFileContent(path, content) {
        return ipcRenderer.invoke('fs:writeFileContent', path, content);
    },
    moveFile(src, dest) {
        return ipcRenderer.invoke('fs:moveFile', src, dest);
    },
    deleteFile(path) {
        return ipcRenderer.invoke('fs:deleteFile', path);
    },
    renameFile(path, newName) {
        return ipcRenderer.invoke('fs:renameFile', path, newName);
    },
    openExternal(path) {
        return ipcRenderer.invoke('shell:openExternal', path);
    },
    onFileChange(callback) {
        const handler = (_event, data) => {
            callback(data);
        };
        ipcRenderer.on('fs:fileChange', handler);
        return () => {
            ipcRenderer.removeListener('fs:fileChange', handler);
        };
    },
    getSettings() {
        return ipcRenderer.invoke('settings:get');
    },
    saveSettings(settings) {
        return ipcRenderer.invoke('settings:save', settings);
    },
    testLLMConnection(config) {
        return ipcRenderer.invoke('llm:testConnection', config);
    },
    sendLLMMessage(messages, config) {
        return ipcRenderer.invoke('llm:sendMessage', messages, config);
    },
    abortLLM() {
        return ipcRenderer.invoke('llm:abort');
    },
};
contextBridge.exposeInMainWorld('electronAPI', api);
