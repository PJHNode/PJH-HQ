const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, screen, Notification, globalShortcut } = require('electron');
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
const lockBridge = require('./modules/lock/bridge');
const media = require('./modules/media/now');
const vdesk = require('./modules/desk/vdesk');
const translate = require('./modules/news/translate');
const translateConfig = require('./modules/news/translate-config');

translate.setConfigSource(() => translateConfig.getSecret());

// PJH Desk: 바탕화면 오른쪽에 떠 있는 위젯. 시계 · 날씨 · 시스템(PC·네트워크·서비스 상태) · 오늘 할 일 ·
// 헤드라인(BBC 한국/세계, GeekNews, Hacker News, 보안 취약점).
// 테두리 없는 반투명 창이고 작업 표시줄에는 나오지 않는다. 트레이 아이콘으로 보이기/숨기기를 한다.

const WIDTH = 380;
const MARGIN = 24;
const MINI = 72;        // 작게 접었을 때 타일 크기
const MINI_MARGIN = 16;
const isWindows = process.platform === 'win32';

let win = null;
let tray = null;
let quitting = false;
let mini = false; // 작게 접힌 상태(앱이 준비된 뒤 저장된 값을 읽는다)
let deskRetries = [];

function defaultBounds(display = screen.getPrimaryDisplay()) {
  const area = display.workArea;
  const height = Math.min(area.height - MARGIN * 2, 1200);
  return { x: area.x + area.width - WIDTH - MARGIN, y: area.y + MARGIN, width: WIDTH, height };
}

// 작게 접은 타일 기본 위치: 그 모니터의 오른쪽 위 구석
function defaultMiniBounds(display) {
  const area = display.workArea;
  return { x: area.x + area.width - MINI - MINI_MARGIN, y: area.y + MINI_MARGIN, width: MINI, height: MINI };
}

function sameDisplay(a, b) {
  return screen.getDisplayMatching(a).id === screen.getDisplayMatching(b).id;
}

// 펼친 위젯 위치: 저장된 위치가 그 모니터에 있으면 그대로, 아니면 그 모니터의 기본 위치
function fullBoundsOn(display) {
  const def = defaultBounds(display);
  const saved = state.get('position');
  if (saved && onSomeDisplay({ ...def, ...saved }) && sameDisplay({ ...def, ...saved }, def)) return { ...def, x: saved.x, y: saved.y };
  return def;
}

function miniBoundsOn(display) {
  const def = defaultMiniBounds(display);
  const saved = state.get('miniPosition');
  if (saved && onSomeDisplay({ ...def, ...saved }) && sameDisplay({ ...def, ...saved }, def)) return { ...def, x: saved.x, y: saved.y };
  return def;
}

function cursorDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
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
    // Windows: '도구 창'이라 Alt+Tab 목록에 안 나온다. (가상 데스크톱 따라가기는 followVirtualDesktop이 맡는다)
    ...(isWindows ? { type: 'toolbar' } : {}),
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
  win.once('ready-to-show', () => {
    if (mini) win.setBounds(miniBoundsOn(screen.getDisplayMatching(win.getBounds())));
    win.showInactive(); // 켜질 때 다른 창의 포커스를 뺏지 않는다
    followVirtualDesktop();
  });
  win.webContents.on('did-finish-load', () => win.webContents.send('desk:mode', mini ? 'mini' : 'full'));

  // 개발용: PJH_DESK_CAPTURE=파일경로 로 실행하면 데이터를 다 불러온 뒤 화면을 PNG로 저장하고 끈다.
  if (process.env.PJH_DESK_CAPTURE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (process.env.PJH_DESK_CAPTURE_TAB) {
          await win.webContents.executeJavaScript(`document.querySelector('[data-tab="${process.env.PJH_DESK_CAPTURE_TAB.replace(/[^a-z]/g, '')}"]').click()`);
          await new Promise((r) => setTimeout(r, 300));
        }
        // PJH_DESK_CAPTURE_CLICK=버튼id 를 주면 그 버튼을 누른 화면을 찍는다(영문·숫자·-만 허용).
        if (process.env.PJH_DESK_CAPTURE_CLICK) {
          const id = process.env.PJH_DESK_CAPTURE_CLICK.replace(/[^a-zA-Z0-9-]/g, '');
          await win.webContents.executeJavaScript(`document.getElementById('${id}') && document.getElementById('${id}').click()`);
          await new Promise((r) => setTimeout(r, 800));
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
    state.set(mini ? 'miniPosition' : 'position', { x, y });
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

// 다른 창 뒤에 깔려 있어도 확실하게 맨 앞으로 꺼낸다.
// Windows는 다른 프로그램 창을 함부로 맨 앞에 못 올리게 막아서, 잠깐 '항상 위'로 올렸다가 원래대로 돌린다.
// 펼친 위젯을 마우스가 있는 모니터에 꺼낸다(이미 그 모니터에 있으면 자리 그대로).
function showWidget() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  const target = cursorDisplay();
  if (mini) setMini(false, target);
  else if (screen.getDisplayMatching(win.getBounds()).id !== target.id) win.setBounds(fullBoundsOn(target));
  win.show();
  win.setAlwaysOnTop(true);
  win.moveTop();
  win.focus();
  setTimeout(() => { if (win) win.setAlwaysOnTop(!!state.get('pinned')); }, 300);
}

function hideWidget() {
  if (win) win.hide();
}

// 작게 접기/펼치기. 접으면 그 모니터 구석의 작은 타일이 되고, 펼치면 원래 자리로 돌아간다.
function setMini(on, display) {
  if (!win) return;
  const where = display || screen.getDisplayMatching(win.getBounds());
  mini = on;
  state.set('mini', on);
  win.setBounds(on ? miniBoundsOn(where) : fullBoundsOn(where));
  win.webContents.send('desk:mode', on ? 'mini' : 'full');
}

// 단축키(Ctrl+Alt+D): 펼친 위젯을 쓰는 중이면 작게 접고, 아니면 마우스 있는 곳에 펼쳐서 꺼낸다.
function toggleWidget() {
  if (!win) return;
  if (win.isVisible() && win.isFocused() && !mini) setMini(true);
  else showWidget();
}

// 위젯이 지금 보고 있는 가상 데스크톱에 없으면 데려온다(Windows).
// 숨겼다 다시 보이면 Windows가 현재 데스크톱에 띄운다. 1분에 3번 넘게 실패하면 잠시 멈춘다.
function followVirtualDesktop() {
  if (!isWindows || !win) return;
  const handle = win.getNativeWindowHandle();
  const hwnd = handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));
  vdesk.start(hwnd.toString(), (stateText) => {
    if (stateText !== 'off' || !win || !win.isVisible()) return;
    const now = Date.now();
    deskRetries = deskRetries.filter((t) => now - t < 60000);
    if (deskRetries.length >= 3) return;
    deskRetries.push(now);
    win.hide();
    win.showInactive();
    win.setAlwaysOnTop(!!state.get('pinned'));
  });
}

function setPinned(pinned) {
  state.set('pinned', pinned);
  if (win) win.setAlwaysOnTop(pinned);
  buildTrayMenu();
  if (win) win.webContents.send('desk:pinned', pinned);
}

function resetPosition() {
  state.set('position', null);
  state.set('miniPosition', null);
  if (win) {
    if (mini) setMini(false, screen.getPrimaryDisplay());
    else win.setBounds(defaultBounds());
  }
  showWidget();
}

function buildTrayMenu() {
  if (!tray) return;
  const items = [
    { label: 'PJH Desk 앞으로 꺼내기  (Ctrl+Alt+D)', click: showWidget },
    { label: '작게 접기', click: () => setMini(true) },
    { label: '숨기기', click: hideWidget },
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
  tray.on('click', showWidget); // 누르면 항상 꺼낸다(숨기기는 메뉴·위젯 버튼으로)
  buildTrayMenu();
}

// 확인용 캡처 모드는 따로 된 저장 폴더를 쓴다. 이미 켜 둔 위젯과 부딪히지 않고 실제 설정·할 일도 건드리지 않는다.
if (process.env.PJH_DESK_CAPTURE) app.setPath('userData', path.join(app.getPath('temp'), 'pjh-desk-capture'));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWidget);
  if (isWindows) app.setAppUserModelId('com.pjh.desk'); // Windows 알림에 앱 이름이 제대로 나오게 한다
  app.whenReady().then(() => {
    mini = !!state.get('mini');
    createWidget();
    createTray();
    if (!globalShortcut.register('Control+Alt+D', toggleWidget)) console.warn('Ctrl+Alt+D 단축키를 다른 프로그램이 쓰고 있어요');
    // 해상도·모니터가 바뀌어 위젯이 화면 밖으로 나가면 기본 위치로 되돌린다.
    screen.on('display-removed', () => { if (win && !onSomeDisplay(win.getBounds())) resetPosition(); });
    screen.on('display-metrics-changed', () => { if (win && !onSomeDisplay(win.getBounds())) resetPosition(); });
  });
  app.on('before-quit', () => { quitting = true; media.stop(); vdesk.stop(); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
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

ipcMain.handle('lock:summary', () => lockBridge.summary());
ipcMain.handle('lock:now', () => lockBridge.lockNow());

ipcMain.handle('translate:get', () => ({ ...translateConfig.getPublic(), status: translate.status() }));
// 키는 렌더러에서 메인으로만 오고, 다시 렌더러로 돌려보내지 않는다.
ipcMain.handle('translate:save', (_e, { provider, key, region }) => {
  const saved = translateConfig.save({ provider: String(provider || ''), key: typeof key === 'string' ? key : undefined, region: typeof region === 'string' ? region : undefined });
  if (win) win.webContents.send('desk:refresh');
  return saved;
});
ipcMain.handle('translate:test', (_e, { provider, key, region }) => {
  const stored = translateConfig.getSecret();
  return translate.testProvider({
    provider: String(provider || stored.provider),
    key: typeof key === 'string' && key.trim() ? key.trim() : (provider === stored.provider ? stored.key : ''),
    region: typeof region === 'string' ? region.trim() : stored.region,
  });
});

ipcMain.handle('media:get', () => media.get());
ipcMain.handle('media:command', (_e, cmd) => media.command(String(cmd)));

// 집중 타이머가 끝났을 때 알림. 제목과 내용은 정해진 문구만 받는다.
ipcMain.on('focus:notify', (_e, kind) => {
  if (!Notification.isSupported()) return;
  const text = kind === 'break-over'
    ? { title: '휴식 끝', body: '다시 집중할 시간이에요.' }
    : { title: '집중 끝', body: '수고했어요. 잠깐 쉬어요.' };
  new Notification({ ...text, icon: path.join(__dirname, 'assets', 'icon.png'), silent: false }).show();
});

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
ipcMain.on('desk:mini', () => setMini(true));
ipcMain.on('desk:expand', () => setMini(false));
// 작은 타일은 클릭도 받아야 해서 창 끌기 영역 대신 직접 옮긴다.
ipcMain.on('desk:dragBy', (_e, { dx, dy }) => {
  if (!win || !mini) return;
  const b = win.getBounds();
  win.setPosition(Math.round(b.x + Number(dx || 0)), Math.round(b.y + Number(dy || 0)));
});
ipcMain.on('desk:dragEnd', () => {
  if (win && mini) { const { x, y } = win.getBounds(); state.set('miniPosition', { x, y }); }
});
ipcMain.on('shell:openExternal', (_e, url) => openExternal(url));
