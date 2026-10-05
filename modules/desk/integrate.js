const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

// Windows 연결: 시작 메뉴 바로 가기, Windows 시작할 때 실행.
// PJH Desk는 portable exe라 실행할 때마다 임시 폴더에 풀린다. 그래서 등록할 때는 임시 경로(process.execPath)가 아니라
// 사용자가 실제로 둔 exe 경로(PORTABLE_EXECUTABLE_FILE)를 쓴다. exe를 옮기면 다음 실행 때 경로를 고친다.

function exePath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function startMenuLink() {
  return path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'PJH Desk.lnk');
}

function canIntegrate() {
  return process.platform === 'win32' && app.isPackaged && !process.env.PJH_DESK_CAPTURE;
}

function updateStartMenu() {
  const link = startMenuLink();
  const exe = exePath();
  try {
    const current = fs.existsSync(link) ? shell.readShortcutLink(link) : null;
    if (current && current.target === exe) return;
    shell.writeShortcutLink(link, current ? 'replace' : 'create', {
      target: exe,
      description: 'PJH Desk - 바탕화면 위젯 + PJH-LOCK',
      icon: exe,
      iconIndex: 0,
      appUserModelId: 'com.pjh.desk',
    });
  } catch {
    // 바로 가기를 못 만들어도 위젯은 그대로 쓸 수 있다.
  }
}

function setAutostart(state, on) {
  state.set('autostart', !!on);
  if (!canIntegrate()) return;
  app.setLoginItemSettings({ openAtLogin: !!on, path: exePath(), name: 'PJH Desk' });
}

function getAutostart(state) {
  const saved = state.get('autostart');
  return saved === undefined ? true : !!saved;
}

// 실행할 때마다 부른다. 처음 실행이면 자동 실행을 켜 둔다.
function setup(state) {
  if (!canIntegrate()) return;
  updateStartMenu();
  setAutostart(state, getAutostart(state)); // 경로가 바뀌었으면 새 경로로 다시 등록
}

module.exports = { setup, setAutostart, getAutostart, exePath };
