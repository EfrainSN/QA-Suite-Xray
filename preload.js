const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updateBridge', {
    getVersion: () => ipcRenderer.invoke('updates:version'),
    checkLatest: () => ipcRenderer.invoke('updates:latest'),
    openRelease: url => ipcRenderer.invoke('updates:open-release', url)
});
