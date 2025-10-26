const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Add IPC methods here as needed
  send: (channel, data) => {
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    const validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  // Filesystem API
  fs: {
    selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),
    readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
    readFile: (path, encoding) => ipcRenderer.invoke('fs:readFile', path, encoding),
    readFileBuffer: (path) => ipcRenderer.invoke('fs:readFileBuffer', path),
    stat: (path) => ipcRenderer.invoke('fs:stat', path),
    exists: (path) => ipcRenderer.invoke('fs:exists', path),
  },

  // Database API
  db: {
    initialize: (config) => ipcRenderer.invoke('db:initialize', config),
    execute: (query) => ipcRenderer.invoke('db:execute', query),
    close: () => ipcRenderer.invoke('db:close'),
  },
});
