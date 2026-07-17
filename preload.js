const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getNews: () => ipcRenderer.invoke('news:fetch'),
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
});
