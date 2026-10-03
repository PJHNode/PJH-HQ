const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

// 지금 재생 중인 곡(Spotify, 브라우저 유튜브, 미디어 플레이어 등)과 재생/다음/이전 조작.
// Windows: 미디어 컨트롤(SMTC)을 읽는 PowerShell 도우미(smtc.ps1)를 하나 띄워 두고 JSON 줄을 받는다.
//          스크립트는 -EncodedCommand로 넘겨서, 앱이 asar로 묶여 있어도 파일 경로 없이 실행된다.
// 리눅스: playerctl이 있으면 2초마다 읽는다(없으면 이 기능은 숨겨진다).

const isWindows = process.platform === 'win32';
const COMMANDS = { toggle: 'play-pause', next: 'next', prev: 'previous' };
const RESTART_MS = 5000;

let state = { status: 'none', playing: false, title: '', artist: '', app: '', canNext: false, canPrev: false };
let proc = null;
let stopping = false;
let restartTimer = null;
let linuxTimer = null;
let supported = true;

function startWindows() {
  if (proc || stopping) return;
  const script = fs.readFileSync(path.join(__dirname, 'smtc.ps1'), 'utf-8');
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
      if (!line.startsWith('{')) continue;
      try {
        state = JSON.parse(line);
      } catch {
        // 깨진 줄은 무시한다.
      }
    }
  });
  proc.on('exit', () => {
    proc = null;
    if (!stopping) restartTimer = setTimeout(startWindows, RESTART_MS);
  });
  proc.on('error', () => {
    supported = false;
  });
}

function playerctl(args) {
  return new Promise((resolve) => {
    execFile('playerctl', args, { timeout: 3000, encoding: 'utf8' }, (err, out) => {
      if (err && err.code === 'ENOENT') supported = false;
      resolve(err ? null : String(out).trim());
    });
  });
}

async function pollLinux() {
  const out = await playerctl(['metadata', '--format', '{{status}}\t{{title}}\t{{artist}}\t{{playerName}}']);
  if (!out) {
    state = { ...state, status: 'none', playing: false, title: '', artist: '', app: '' };
    return;
  }
  const [status, title, artist, app] = out.split('\t');
  state = { status, playing: status === 'Playing', title: title || '', artist: artist || '', app: app || '', canNext: true, canPrev: true };
}

function start() {
  if (isWindows) startWindows();
  else if (!linuxTimer) {
    pollLinux();
    linuxTimer = setInterval(pollLinux, 2000);
  }
}

function get() {
  start();
  return { ...state, supported };
}

async function command(cmd) {
  if (!COMMANDS[cmd]) return get();
  if (isWindows) {
    if (proc) proc.stdin.write(`${cmd}\n`);
  } else {
    await playerctl([COMMANDS[cmd]]);
    await pollLinux();
  }
  return get();
}

function stop() {
  stopping = true;
  clearTimeout(restartTimer);
  clearInterval(linuxTimer);
  if (proc) {
    proc.stdin.end(); // 도우미는 입력이 닫히면 스스로 끝난다
    const p = proc;
    setTimeout(() => { try { p.kill(); } catch { /* 이미 끝남 */ } }, 1500);
  }
}

module.exports = { get, command, stop };
