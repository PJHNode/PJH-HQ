// 영어 제목을 한국어로 번역한다. 설정에서 고른 서비스를 쓴다.
//   deepl     : DeepL API (무료 키는 끝이 ":fx", api-free.deepl.com)
//   microsoft : Microsoft Translator (Azure 키, 필요하면 리전)
//   google    : Google 번역 무료 주소(키 없음, 비공식이라 막힐 수 있음)
//   off       : 번역하지 않음
// 여러 제목을 한 번에 보내고, 한 번 번역한 제목은 기억해 두어 새로고침 때 다시 요청하지 않는다.
// 한도 초과(429·456)를 받으면 그 서비스는 30분 동안 쉰다.

const GOOGLE = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t';
const MICROSOFT = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=ko';
const CHUNK_CHARS = 4000;
const CHUNK_ITEMS = 50;
const CACHE_LIMIT = 2000;
const BACKOFF_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 10000;

const cache = new Map();
const pausedUntil = {};
let cacheProvider = null;
let lastError = null;
let configSource = () => ({ provider: 'google', key: '', region: '' });

// 메인 프로세스가 설정을 읽는 함수를 넘겨준다(이 파일은 Electron 없이도 테스트할 수 있게 둔다).
function setConfigSource(fn) {
  configSource = fn;
}

class TranslateError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function explain(provider, status) {
  if (status === 403 || status === 401) return provider === 'microsoft' ? '키 또는 리전이 맞지 않아요' : 'API 키가 맞지 않아요';
  if (status === 456) return 'DeepL 무료 사용량을 이번 달에 다 썼어요';
  if (status === 429) return '요청이 너무 많아서 잠시 막혔어요';
  if (status === 400) return '요청 형식이 잘못됐어요';
  return `번역 실패 (${status})`;
}

async function post(url, init, provider) {
  const res = await fetch(url, { ...init, method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 429 || res.status === 456) pausedUntil[provider] = Date.now() + BACKOFF_MS;
  if (!res.ok) throw new TranslateError(explain(provider, res.status), res.status);
  return res.json();
}

const engines = {
  async google(chunk) {
    const data = await post(GOOGLE, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `q=${encodeURIComponent(chunk.join('\n'))}`,
    }, 'google');
    const lines = (data[0] || []).map((seg) => seg[0]).join('').split('\n').map((l) => l.trim());
    // 줄 수가 어긋나면 어느 번역이 어느 제목 것인지 알 수 없으니 버린다.
    return lines.length === chunk.length ? lines : null;
  },

  async deepl(chunk, cfg) {
    const host = cfg.key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const data = await post(`${host}/v2/translate`, {
      headers: { Authorization: `DeepL-Auth-Key ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: chunk, source_lang: 'EN', target_lang: 'KO' }),
    }, 'deepl');
    const out = (data.translations || []).map((t) => t.text);
    return out.length === chunk.length ? out : null;
  },

  async microsoft(chunk, cfg) {
    const headers = { 'Ocp-Apim-Subscription-Key': cfg.key, 'Content-Type': 'application/json' };
    if (cfg.region) headers['Ocp-Apim-Subscription-Region'] = cfg.region;
    const data = await post(MICROSOFT, { headers, body: JSON.stringify(chunk.map((Text) => ({ Text }))) }, 'microsoft');
    const out = (data || []).map((d) => (d.translations && d.translations[0] ? d.translations[0].text : ''));
    return out.length === chunk.length ? out : null;
  },
};

function activeConfig() {
  const cfg = configSource() || {};
  const provider = cfg.provider || 'google';
  if ((provider === 'deepl' || provider === 'microsoft') && !cfg.key) return { ...cfg, provider: 'off', missingKey: true };
  return { ...cfg, provider };
}

function remember(source, translated) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(source, translated);
}

function chunked(list) {
  const chunks = [];
  let current = [];
  let length = 0;
  for (const t of list) {
    if (current.length && (length + t.length + 1 > CHUNK_CHARS || current.length >= CHUNK_ITEMS)) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(t);
    length += t.length + 1;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

// 줄바꿈 없는 한 줄짜리 제목 목록만 받는다. 실패한 항목은 빈 문자열.
async function translateMany(texts) {
  const clean = texts.map((t) => String(t || '').replace(/\s+/g, ' ').trim());
  const cfg = activeConfig();
  if (cfg.provider === 'off') return clean.map(() => '');

  // 서비스를 바꾸면 이전 서비스의 번역은 버린다.
  if (cacheProvider !== cfg.provider) {
    cache.clear();
    cacheProvider = cfg.provider;
  }
  if (Date.now() < (pausedUntil[cfg.provider] || 0)) return clean.map((t) => cache.get(t) || '');

  const todo = [...new Set(clean.filter((t) => t && !cache.has(t)))];
  for (const chunk of chunked(todo)) {
    try {
      const out = await engines[cfg.provider](chunk, cfg);
      if (out) chunk.forEach((t, i) => remember(t, out[i]));
      lastError = null;
    } catch (err) {
      lastError = { provider: cfg.provider, message: err.message, at: Date.now() };
      break; // 한 덩어리가 실패하면 나머지도 실패할 가능성이 높다
    }
  }
  return clean.map((t) => cache.get(t) || '');
}

// 설정 화면의 "테스트" 버튼. 기억해 둔 번역을 쓰지 않고 실제로 한 번 요청한다.
async function testProvider(cfg) {
  if (cfg.provider === 'off') return { ok: true, text: '번역을 쓰지 않아요' };
  if ((cfg.provider === 'deepl' || cfg.provider === 'microsoft') && !cfg.key) return { ok: false, text: 'API 키를 넣어 주세요' };
  try {
    const out = await engines[cfg.provider](['Hello, world. The weather is nice today.'], cfg);
    return out ? { ok: true, text: out[0] } : { ok: false, text: '응답 형식이 예상과 달라요' };
  } catch (err) {
    return { ok: false, text: err.message };
  }
}

function status() {
  const cfg = activeConfig();
  return { provider: cfg.provider, missingKey: !!cfg.missingKey, lastError, pausedUntil: pausedUntil[cfg.provider] || 0 };
}

async function translateToKorean(text) {
  const [result] = await translateMany([text]);
  if (!result) throw new Error('번역 실패');
  return result;
}

module.exports = { translateMany, translateToKorean, testProvider, setConfigSource, status };
