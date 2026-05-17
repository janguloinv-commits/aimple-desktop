const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  queryClause: (data) => ipcRenderer.invoke('query-claude', data),
  checkBackend: () => ipcRenderer.invoke('check-backend'),
});
