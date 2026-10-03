// 영어 제목을 한국어로 번역한다(Google 번역 무료 주소).
// 제목마다 따로 요청하면 금방 429(요청이 너무 많음)가 나서, 여러 제목을 줄바꿈으로 이어 한 번에 보낸다.
// 한 번 번역한 제목은 기억해 두어 새로고침 때 다시 요청하지 않는다.

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t';
const CHUNK_CHARS = 4000;
const CACHE_LIMIT = 2000;
const BACKOFF_MS = 30 * 60 * 1000;
const cache = new Map();
let pausedUntil = 0; // 429를 받으면 한동안 요청하지 않는다(계속 보내면 차단이 길어진다)

async function requestTranslation(text) {
  if (Date.now() < pausedUntil) throw new Error('번역 잠시 중단 중');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `q=${encodeURIComponent(text)}`,
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 429) pausedUntil = Date.now() + BACKOFF_MS;
  if (!res.ok) throw new Error(`번역 실패 (${res.status})`);
  const data = await res.json();
  return (data[0] || []).map((seg) => seg[0]).join('');
}

function remember(source, translated) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(source, translated);
}

// 줄바꿈 없는 한 줄짜리 제목 목록만 받는다. 실패한 항목은 빈 문자열.
async function translateMany(texts) {
  const clean = texts.map((t) => String(t || '').replace(/\s+/g, ' ').trim());
  const todo = [...new Set(clean.filter((t) => t && !cache.has(t)))];

  // 긴 목록은 몇 덩어리로 나눈다.
  const chunks = [];
  let current = [];
  let length = 0;
  for (const t of todo) {
    if (current.length && length + t.length + 1 > CHUNK_CHARS) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(t);
    length += t.length + 1;
  }
  if (current.length) chunks.push(current);

  for (const chunk of chunks) {
    try {
      const lines = (await requestTranslation(chunk.join('\n'))).split('\n').map((l) => l.trim());
      // 줄 수가 어긋나면 어느 번역이 어느 제목 것인지 알 수 없으니 이 덩어리는 버린다.
      if (lines.length === chunk.length) chunk.forEach((t, i) => remember(t, lines[i]));
    } catch {
      // 번역 실패는 원문만 보여주면 되니 조용히 넘어간다.
    }
  }
  return clean.map((t) => cache.get(t) || '');
}

async function translateToKorean(text) {
  const [result] = await translateMany([text]);
  if (!result) throw new Error('번역 실패');
  return result;
}

module.exports = { translateMany, translateToKorean };
