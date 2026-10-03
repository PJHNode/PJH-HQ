const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getNews: () => ipcRenderer.invoke('news:fetch'),
  getHackerNews: () => ipcRenderer.invoke('hn:fetch'),
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
  weather: {
    detectLocation: () => ipcRenderer.invoke('weather:detectLocation'),
    search: (query) => ipcRenderer.invoke('weather:search', query),
    get: (latitude, longitude) => ipcRenderer.invoke('weather:get', { latitude, longitude }),
  },
  todo: {
    list: () => ipcRenderer.invoke('todo:list'),
    add: (text) => ipcRenderer.invoke('todo:add', text),
    toggle: (id) => ipcRenderer.invoke('todo:toggle', id),
    remove: (id) => ipcRenderer.invoke('todo:remove', id),
  },
  desk: {
    getPinned: () => ipcRenderer.invoke('desk:getPinned'),
    togglePin: () => ipcRenderer.invoke('desk:togglePin'),
    hide: () => ipcRenderer.send('desk:hide'),
    onPinned: (fn) => ipcRenderer.on('desk:pinned', (_e, pinned) => fn(pinned)),
    onRefresh: (fn) => ipcRenderer.on('desk:refresh', () => fn()),
  },
});
