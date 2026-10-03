const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// PJH-LOCK 연결: "지금 잠그기"와 오늘 자리 비움 요약.
// 잠그기는 PJH-LOCK에 신호(Local\PJH-LOCK-LockRequest)를 보내고, PJH-LOCK이 없거나 예전 버전이면
// 운영체제 기본 잠금으로 대신 잠근다(Windows: LockWorkStation, 리눅스: loginctl).

const isWindows = process.platform === 'win32';

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 8000, encoding: 'utf8' }, (err, out) => resolve(err ? null : String(out).trim()));
  });
}

const SIGNAL_SCRIPT = [
  'try { $e = [Threading.EventWaitHandle]::OpenExisting(\'Local\\PJH-LOCK-LockRequest\'); [void]$e.Set(); \'pjh\' }',
  'catch { try { [void][Threading.EventWaitHandle]::OpenExisting(\'Local\\PJH-LOCK-Locked\'); \'old\' } catch { \'none\' } }',
].join(' ');

async function lockNow() {
  if (!isWindows) {
    const ok = await run('loginctl', ['lock-session']);
    return { via: ok === null ? 'failed' : 'system' };
  }
  const answer = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SIGNAL_SCRIPT]);
  if (answer === 'pjh') return { via: 'pjh-lock' };
  await run('rundll32.exe', ['user32.dll,LockWorkStation']);
  return { via: 'system', reason: answer === 'old' ? 'old-pjh-lock' : 'no-pjh-lock' };
}

function logPath() {
  if (!isWindows) return null;
  return path.join(process.env.APPDATA || '', 'PJH-LOCK', 'log.txt');
}

function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 오늘 기록만 읽어서 잠금 횟수, 자리 비운 시간, 비밀번호 실패, Windows 잠금 전환을 센다.
function summary() {
  const file = logPath();
  if (!file || !fs.existsSync(file)) return null;
  let text;
  try {
    text = fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
  const today = todayKey();
  const out = { locks: 0, awayMs: 0, failures: 0, osLocks: 0, incidents: 0, lastUnlock: null, lockedNow: false };
  let openAt = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(today)) continue;
    const at = new Date(line.slice(0, 19).replace(' ', 'T')).getTime();
    const msg = line.slice(19).trim();
    if (msg === '잠금' || msg.startsWith('잠금 (')) {
      out.locks++;
      if (openAt == null) openAt = at;
    } else if (msg.startsWith('잠금 해제')) {
      if (openAt != null) out.awayMs += at - openAt;
      openAt = null;
      out.lastUnlock = at;
    } else if (/^(비밀번호|PIN) 실패/.test(msg)) {
      out.failures++;
    } else if (msg.startsWith('Windows 잠금으로 전환')) {
      out.osLocks++;
    } else if (msg.includes('본체가 잠금 중에 종료됨')) {
      out.incidents++;
    }
  }
  out.lockedNow = openAt != null;
  return out;
}

module.exports = { lockNow, summary };
