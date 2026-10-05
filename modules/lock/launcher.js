const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const { app } = require('electron');

// PJH Desk 안에 들어 있는 PJH-LOCK을 함께 실행한다(Windows).
// PJH Desk(portable exe)는 실행할 때마다 임시 폴더에 풀렸다가 꺼지면 지워지므로,
// PJH-LOCK은 고정된 자리(%LOCALAPPDATA%\PJH-Desk\PJH-LOCK\)에 복사해서 띄운다. 그래야 PJH Desk를 꺼도 계속 지킨다.
// 이미 PJH-LOCK이 돌고 있으면(직접 실행한 다른 복사본 포함) 아무것도 하지 않는다.

function bundledPath() {
  // 패키지: resources/PJH-LOCK.exe, 개발 실행: 옆 폴더의 PJH-LOCK 빌드 결과
  const packaged = path.join(process.resourcesPath || '', 'PJH-LOCK.exe');
  if (app.isPackaged && fs.existsSync(packaged)) return packaged;
  const dev = path.join(__dirname, '..', '..', '..', 'PJH-LOCK', 'bin', 'PJH-LOCK.exe');
  return fs.existsSync(dev) ? dev : null;
}

function installedPath() {
  const base = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
  return path.join(base, 'PJH-Desk', 'PJH-LOCK', 'PJH-LOCK.exe');
}

function sha1(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

function isRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq PJH-LOCK.exe', '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 }, (err, out) => {
      resolve(!err && /PJH-LOCK\.exe/i.test(String(out)));
    });
  });
}

// 반환: { status: 'running' | 'started' | 'missing' | 'failed', path?, message? }
async function ensureRunning() {
  if (process.platform !== 'win32') return { status: 'unsupported' };
  if (await isRunning()) return { status: 'running' };

  const source = bundledPath();
  const target = installedPath();
  try {
    if (source) {
      // 고정된 자리의 복사본이 없거나 PJH Desk에 든 것과 다르면(업데이트) 새로 복사한다.
      if (!fs.existsSync(target) || sha1(target) !== sha1(source)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
      }
    }
    if (!fs.existsSync(target)) return { status: 'missing' };
    const child = spawn(target, [], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    return { status: 'started', path: target };
  } catch (err) {
    return { status: 'failed', message: err.message };
  }
}

module.exports = { ensureRunning, isRunning, installedPath };
