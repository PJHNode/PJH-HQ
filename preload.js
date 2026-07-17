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
    add: (text, x, y) => ipcRenderer.invoke('memo:add', { text, x, y }),
    updateText: (id, text) => ipcRenderer.invoke('memo:updateText', { id, text }),
    updatePosition: (id, x, y) => ipcRenderer.invoke('memo:updatePosition', { id, x, y }),
    toggle: (id) => ipcRenderer.invoke('memo:toggle', id),
    delete: (id) => ipcRenderer.invoke('memo:delete', id),
    connect: (fromId, toId) => ipcRenderer.invoke('memo:connect', { fromId, toId }),
    disconnect: (id) => ipcRenderer.invoke('memo:disconnect', id),
  },
});
