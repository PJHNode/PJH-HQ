const net = require('net');
const os = require('os');
const { execFile } = require('child_process');

// 네트워크 정보: 응답 속도(1.1.1.1, 8.8.8.8), 공인/로컬 IP, 연결 종류(와이파이 이름·신호 또는 유선).
// 응답 속도는 ping 대신 443 포트 TCP 연결 시간을 잰다. 관리자 권한이 필요 없고 Windows·리눅스에서 똑같이 동작한다.

const isWindows = process.platform === 'win32';
const TARGETS = [
  { id: 'cf', label: '1.1.1.1', host: '1.1.1.1' },
  { id: 'google', label: '8.8.8.8', host: '8.8.8.8' },
];
const PING_EVERY_MS = 5000;
const HISTORY = 36; // 5초 × 36 = 3분
const PUBLIC_IP_EVERY_MS = 30 * 60 * 1000;
const LINK_EVERY_MS = 15 * 1000;
const VIRTUAL = /loopback|vethernet|vmware|virtualbox|hyper-v|wsl|docker|vpn|tailscale|zerotier|bluetooth|^lo$|^veth|^br-|^virbr/i;

const history = Object.fromEntries(TARGETS.map((t) => [t.id, []]));
let timer = null;
let publicIp = { value: null, at: 0 };
let link = { value: null, at: 0 };

function tcpLatency(host, port = 443, timeout = 2000) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const sock = net.connect({ host, port });
    const done = (ms) => { sock.destroy(); resolve(ms); };
    sock.setTimeout(timeout, () => done(null));
    sock.once('connect', () => done(Number(process.hrtime.bigint() - start) / 1e6));
    sock.once('error', () => done(null));
  });
}

async function pingAll() {
  const results = await Promise.all(TARGETS.map((t) => tcpLatency(t.host)));
  TARGETS.forEach((t, i) => {
    const h = history[t.id];
    h.push(results[i] == null ? null : Math.round(results[i]));
    if (h.length > HISTORY) h.shift();
  });
}

function start() {
  if (timer) return;
  pingAll();
  timer = setInterval(pingAll, PING_EVERY_MS);
}

function localIp() {
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    const v4 = (addrs || []).find((a) => a.family === 'IPv4' && !a.internal);
    if (v4) return { address: v4.address, iface: name };
  }
  return null;
}

async function getPublicIp() {
  if (publicIp.value && Date.now() - publicIp.at < PUBLIC_IP_EVERY_MS) return publicIp.value;
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(8000) });
    if (res.ok) publicIp = { value: (await res.json()).ip || null, at: Date.now() };
  } catch {
    // 다음 호출 때 다시 시도
  }
  return publicIp.value;
}

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 4000, encoding: 'utf8' }, (err, out) => resolve(err ? null : String(out)));
  });
}

// 와이파이면 이름과 신호 세기, 아니면 유선으로 본다.
async function getLink() {
  if (link.at && Date.now() - link.at < LINK_EVERY_MS) return link.value;
  let value = null;
  if (isWindows) {
    // 출력이 한글 Windows에서도 깨지지 않게 UTF-8 코드 페이지로 바꿔서 실행한다.
    const out = await run('cmd.exe', ['/d', '/c', 'chcp 65001 >nul & netsh wlan show interfaces']);
    if (out && /^\s*SSID\s*:/m.test(out)) {
      const ssid = (out.match(/^\s*SSID\s*:\s*(.+)$/m) || [])[1];
      const signal = (out.match(/:\s*(\d+)%/) || [])[1];
      value = { type: 'wifi', ssid: ssid ? ssid.trim() : '', signal: signal ? Number(signal) : null };
    }
  } else {
    const out = await run('nmcli', ['-t', '-f', 'ACTIVE,SSID,SIGNAL', 'dev', 'wifi']);
    const line = out && out.split('\n').find((l) => l.startsWith('yes:'));
    if (line) {
      const parts = line.split(':');
      value = { type: 'wifi', ssid: parts.slice(1, -1).join(':'), signal: Number(parts[parts.length - 1]) || null };
    }
  }
  if (!value) value = localIp() ? { type: 'wired' } : { type: 'offline' };
  link = { value, at: Date.now() };
  return value;
}

async function info() {
  start();
  const [pub, conn] = await Promise.all([getPublicIp(), getLink()]);
  return {
    publicIp: pub,
    local: localIp(),
    link: conn,
    latency: TARGETS.map((t) => ({ id: t.id, label: t.label, history: history[t.id].slice() })),
  };
}

module.exports = { info, start };
