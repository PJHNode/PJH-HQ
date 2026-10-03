const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const { fetchTodayNews } = require('./modules/news/fetch');
const { fetchHackerNews } = require('./modules/hn/fetch');
const weather = require('./modules/weather/fetch');
const todo = require('./modules/todo/store');
const state = require('./modules/state');
const sys = require('./modules/sys/stats');
const netInfo = require('./modules/net/info');
const { fetchStatus } = require('./modules/status/fetch');
const { fetchGeekNews } = require('./modules/geek/fetch');
const { fetchKev } = require('./modules/kev/fetch');

// PJH Desk: 바탕화면 오른쪽에 떠 있는 위젯. 시계 · 날씨 · 시스템(PC·네트워크·서비스 상태) · 오늘 할 일 ·
// 헤드라인(BBC 한국/세계, GeekNews, Hacker News, 보안 취약점).
// 테두리 없는 반투명 창이고 작업 표시줄에는 나오지 않는다. 트레이 아이콘으로 보이기/숨기기를 한다.

const WIDTH = 380;
const MARGIN = 24;
const isWindows = process.platform === 'win32';

let win = null;
let tray = null;
let quitting = false;

function defaultBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  const height = Math.min(area.height - MARGIN * 2, 980);
  return { x: area.x + area.width - WIDTH - MARGIN, y: area.y + MARGIN, width: WIDTH, height };
}

// 모니터를 뺐거나 해상도가 바뀌어서 저장된 위치가 화면 밖이면 기본 위치로 돌린다.
function onSomeDisplay(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x + 60 > a.x && b.x < a.x + a.width - 60 && b.y >= a.y - 20 && b.y < a.y + a.height - 60);
}

function startBounds() {
  const def = defaultBounds();
  const saved = state.get('position');
  if (saved && onSomeDisplay({ ...def, ...saved })) return { ...def, x: saved.x, y: saved.y };
  return def;
}

function createWidget() {
  win = new BrowserWindow({
    ...startBounds(),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    alwaysOnTop: !!state.get('pinned'),
    title: 'PJH Desk',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (!isWindows) win.setVisibleOnAllWorkspaces(true);

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.showInactive()); // 켜질 때 다른 창의 포커스를 뺏지 않는다

  // 개발용: PJH_DESK_CAPTURE=파일경로 로 실행하면 데이터를 다 불러온 뒤 화면을 PNG로 저장하고 끈다.
  if (process.env.PJH_DESK_CAPTURE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (process.env.PJH_DESK_CAPTURE_TAB) {
          await win.webContents.executeJavaScript(`document.querySelector('[data-tab="${process.env.PJH_DESK_CAPTURE_TAB.replace(/[^a-z]/g, '')}"]').click()`);
          await new Promise((r) => setTimeout(r, 300));
        }
        const image = await win.webContents.capturePage();
        require('fs').writeFileSync(process.env.PJH_DESK_CAPTURE, image.toPNG());
        quitting = true;
        app.quit();
      }, Number(process.env.PJH_DESK_CAPTURE_DELAY || 9000));
    });
  }

  win.on('moved', () => {
    const { x, y } = win.getBounds();
    state.set('position', { x, y });
  });
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // 위젯 안의 링크가 위젯 창 안에서 열리지 않게 막고 기본 브라우저로 연다.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function openExternal(url) {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
}

function showWidget() {
  if (!win) return;
  win.showInactive();
  win.moveTop();
}

function toggleWidget() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else showWidget();
}

function setPinned(pinned) {
  state.set('pinned', pinned);
  if (win) win.setAlwaysOnTop(pinned);
  buildTrayMenu();
  if (win) win.webContents.send('desk:pinned', pinned);
}

function resetPosition() {
  state.set('position', null);
  if (win) win.setBounds(defaultBounds());
  showWidget();
}

function buildTrayMenu() {
  if (!tray) return;
  const items = [
    { label: 'PJH Desk 보이기/숨기기', click: toggleWidget },
    { label: '항상 위에 두기', type: 'checkbox', checked: !!state.get('pinned'), click: (m) => setPinned(m.checked) },
    { label: '새로고침', click: () => win && win.webContents.send('desk:refresh') },
    { label: '위치 처음으로', click: resetPosition },
    { type: 'separator' },
  ];
  if (isWindows) {
    items.push({
      label: 'Windows 시작할 때 실행',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }),
    });
    items.push({ type: 'separator' });
  }
  items.push({ label: '종료', click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png')));
  tray.setToolTip('PJH Desk');
  tray.on('click', toggleWidget);
  buildTrayMenu();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWidget);
  app.whenReady().then(() => {
    createWidget();
    createTray();
    // 해상도·모니터가 바뀌어 위젯이 화면 밖으로 나가면 기본 위치로 되돌린다.
    screen.on('display-removed', () => { if (win && !onSomeDisplay(win.getBounds())) resetPosition(); });
    screen.on('display-metrics-changed', () => { if (win && !onSomeDisplay(win.getBounds())) resetPosition(); });
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => {}); // 트레이에 남는다
}

// ---- 렌더러와 주고받는 기능 ----

ipcMain.handle('news:fetch', () => fetchTodayNews());
ipcMain.handle('hn:fetch', () => fetchHackerNews());
ipcMain.handle('geek:fetch', () => fetchGeekNews());
ipcMain.handle('kev:fetch', () => fetchKev());

ipcMain.handle('sys:sample', () => sys.sample());
ipcMain.handle('net:info', () => netInfo.info());
ipcMain.handle('status:fetch', () => fetchStatus());

ipcMain.handle('weather:detectLocation', () => weather.detectLocation());
ipcMain.handle('weather:search', (_e, query) => weather.searchLocation(String(query || '')));
ipcMain.handle('weather:get', (_e, { latitude, longitude }) => weather.getWeather(Number(latitude), Number(longitude)));

ipcMain.handle('todo:list', () => todo.list());
ipcMain.handle('todo:add', (_e, text) => todo.add(text));
ipcMain.handle('todo:toggle', (_e, id) => todo.toggle(String(id)));
ipcMain.handle('todo:remove', (_e, id) => todo.remove(String(id)));

ipcMain.handle('desk:getPinned', () => !!state.get('pinned'));
ipcMain.handle('desk:togglePin', () => { setPinned(!state.get('pinned')); return !!state.get('pinned'); });
ipcMain.on('desk:hide', () => win && win.hide());
ipcMain.on('shell:openExternal', (_e, url) => openExternal(url));
