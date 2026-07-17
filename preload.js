const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getNews: () => ipcRenderer.invoke('news:fetch'),
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
  weather: {
    detectLocation: () => ipcRenderer.invoke('weather:detectLocation'),
    search: (query) => ipcRenderer.invoke('weather:search', query),
    get: (latitude, longitude) => ipcRenderer.invoke('weather:get', { latitude, longitude }),
  },
  memo: {
    list: () => ipcRenderer.invoke('memo:list'),
    add: (text) => ipcRenderer.invoke('memo:add', text),
    toggle: (id) => ipcRenderer.invoke('memo:toggle', id),
    delete: (id) => ipcRenderer.invoke('memo:delete', id),
  },
});
