const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// 내 PC 상태: CPU, 메모리, 디스크, 네트워크 속도, 켜진 시간.
// 렌더러가 몇 초마다 부르면, 직전 호출과의 차이로 CPU 사용률과 네트워크 속도를 계산한다.

const isWindows = process.platform === 'win32';
const DISK_CACHE_MS = 60 * 1000;

let lastCpu = null;
let lastNet = null;
let diskCache = null;

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  return { idle, total };
}

function cpuPercent() {
  const now = cpuTimes();
  const prev = lastCpu;
  lastCpu = now;
  if (!prev || now.total === prev.total) return null;
  return Math.round((1 - (now.idle - prev.idle) / (now.total - prev.total)) * 100);
}

function disk() {
  if (diskCache && Date.now() - diskCache.at < DISK_CACHE_MS) return diskCache.value;
  let value = null;
  try {
    const root = isWindows ? `${(process.env.SystemDrive || 'C:')}/` : '/';
    const s = fs.statfsSync(root);
    value = { name: isWindows ? (process.env.SystemDrive || 'C:') : '/', free: s.bavail * s.bsize, total: s.blocks * s.bsize };
  } catch {
    value = null;
  }
  diskCache = { at: Date.now(), value };
  return value;
}

// 전체 받은/보낸 바이트 수. Windows는 netstat -e, 리눅스는 /proc/net/dev.
function netBytes() {
  return new Promise((resolve) => {
    if (isWindows) {
      execFile('netstat', ['-e'], { windowsHide: true, timeout: 3000 }, (err, out) => {
        if (err) return resolve(null);
        // 줄 이름은 Windows 언어에 따라 "Bytes"/"바이트"로 바뀌고 인코딩도 달라서,
        // 숫자 두 개가 있는 첫 줄(항상 바이트 줄)을 읽는다.
        const line = String(out).split(/\r?\n/).find((l) => /\s(\d+)\s+(\d+)\s*$/.test(l));
        const m = line && line.match(/\s(\d+)\s+(\d+)\s*$/);
        resolve(m ? { rx: Number(m[1]), tx: Number(m[2]) } : null);
      });
      return;
    }
    fs.readFile('/proc/net/dev', 'utf-8', (err, text) => {
      if (err) return resolve(null);
      let rx = 0;
      let tx = 0;
      for (const line of text.split('\n').slice(2)) {
        const [name, rest] = line.split(':');
        if (!rest || name.trim() === 'lo') continue;
        const f = rest.trim().split(/\s+/).map(Number);
        rx += f[0];
        tx += f[8];
      }
      resolve({ rx, tx });
    });
  });
}

async function netRate() {
  const now = await netBytes();
  const at = Date.now();
  const prev = lastNet;
  if (now) lastNet = { ...now, at };
  if (!now || !prev || at <= prev.at) return null;
  const sec = (at - prev.at) / 1000;
  return {
    down: Math.max(0, (now.rx - prev.rx) / sec),
    up: Math.max(0, (now.tx - prev.tx) / sec),
  };
}

async function sample() {
  const total = os.totalmem();
  return {
    cpu: cpuPercent(),
    cores: os.cpus().length,
    mem: { used: total - os.freemem(), total },
    disk: disk(),
    net: await netRate(),
    uptime: os.uptime(),
  };
}

module.exports = { sample };
