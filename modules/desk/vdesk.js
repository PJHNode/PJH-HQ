const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Windows 가상 데스크톱 따라가기.
// 도우미(vdesk.ps1)가 위젯 창이 지금 보고 있는 데스크톱에 있는지 알려주면(on/off),
// off일 때 onOff()를 불러 위젯이 지금 데스크톱으로 오게 한다(숨겼다 다시 보이면 Windows가 현재 데스크톱에 띄운다).
// 남의 창을 옮기는 건 Windows가 막아서, 옮기는 일은 위젯 쪽에서 직접 한다.

const RESTART_MS = 5000;

let proc = null;
let stopping = false;
let restartTimer = null;

function start(hwnd, onState) {
  if (process.platform !== 'win32' || proc || stopping) return;
  const script = fs.readFileSync(path.join(__dirname, 'vdesk.ps1'), 'utf-8').split('__HWND__').join(String(hwnd));
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  let buffer = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (line) onState(line);
    }
  });
  proc.on('exit', () => {
    proc = null;
    if (!stopping) restartTimer = setTimeout(() => start(hwnd, onState), RESTART_MS);
  });
  proc.on('error', () => {});
}

function stop() {
  stopping = true;
  clearTimeout(restartTimer);
  if (proc) {
    proc.stdin.end();
    const p = proc;
    setTimeout(() => { try { p.kill(); } catch { /* 이미 끝남 */ } }, 1500);
  }
}

module.exports = { start, stop };
