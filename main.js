const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { fetchTodayNews } = require('./modules/news/fetch');
const weather = require('./modules/weather/fetch');
const memoStore = require('./modules/memo/store');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('news:fetch', async () => {
  return fetchTodayNews();
});

ipcMain.on('shell:openExternal', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});

ipcMain.handle('weather:detectLocation', () => weather.detectLocation());
ipcMain.handle('weather:search', (_event, query) => weather.searchLocation(query));
ipcMain.handle('weather:get', (_event, { latitude, longitude }) => weather.getWeather(latitude, longitude));

ipcMain.handle('memo:list', () => memoStore.listBoard());
ipcMain.handle('memo:add', (_event, { text, x, y }) => memoStore.addNote(text, x, y));
ipcMain.handle('memo:updateText', (_event, { id, text }) => memoStore.updateNoteText(id, text));
ipcMain.handle('memo:updatePosition', (_event, { id, x, y }) => memoStore.updateNotePosition(id, x, y));
ipcMain.handle('memo:toggle', (_event, id) => memoStore.toggleNote(id));
ipcMain.handle('memo:delete', (_event, id) => memoStore.deleteNote(id));
ipcMain.handle('memo:connect', (_event, { fromId, toId }) => memoStore.addConnection(fromId, toId));
ipcMain.handle('memo:disconnect', (_event, id) => memoStore.deleteConnection(id));
