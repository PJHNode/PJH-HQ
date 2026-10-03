const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

// 번역 설정(어느 서비스를 쓸지, API 키, Microsoft 리전). userData/translate.json 에 저장한다.
// API 키는 Electron safeStorage로 암호화한다(Windows: DPAPI, 리눅스: 키링).
// 암호화를 쓸 수 없는 환경이면 키를 저장하지 않고 알려준다.

const PROVIDERS = ['google', 'deepl', 'microsoft', 'off'];

function filePath() {
  return path.join(app.getPath('userData'), 'translate.json');
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(filePath(), 'utf-8')) || {};
  } catch {
    return {};
  }
}

function write(data) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(data, null, 2), 'utf-8');
}

function decryptKey(data) {
  if (!data.keyEnc) return '';
  try {
    return safeStorage.decryptString(Buffer.from(data.keyEnc, 'base64'));
  } catch {
    return '';
  }
}

// 렌더러에 보여줄 정보. 키 자체는 절대 넘기지 않고 끝 4자리만 보여준다.
function getPublic() {
  const data = read();
  const key = decryptKey(data);
  return {
    provider: PROVIDERS.includes(data.provider) ? data.provider : 'google',
    region: data.region || '',
    hasKey: !!key,
    keyHint: key ? `…${key.slice(-4)}` : '',
    canEncrypt: safeStorage.isEncryptionAvailable(),
  };
}

// 메인 프로세스 번역 모듈이 쓸 실제 설정
function getSecret() {
  const data = read();
  return { provider: PROVIDERS.includes(data.provider) ? data.provider : 'google', key: decryptKey(data), region: data.region || '' };
}

// key가 undefined면 기존 키를 그대로 둔다. 빈 문자열이면 지운다.
function save({ provider, key, region }) {
  const data = read();
  if (PROVIDERS.includes(provider)) data.provider = provider;
  if (typeof region === 'string') data.region = region.trim().slice(0, 40);
  if (typeof key === 'string') {
    const k = key.trim();
    if (!k) {
      delete data.keyEnc;
    } else {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('이 PC에서는 키를 안전하게 저장할 수 없어요(암호화 저장소 없음)');
      data.keyEnc = safeStorage.encryptString(k.slice(0, 200)).toString('base64');
    }
  }
  write(data);
  return getPublic();
}

module.exports = { getPublic, getSecret, save, PROVIDERS };
