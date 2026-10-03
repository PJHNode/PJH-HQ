// 자주 쓰는 서비스가 지금 정상인지 공식 상태 페이지에서 확인한다.
// Statuspage(GitHub, Cloudflare, Discord, Claude, OpenAI)는 같은 형식의 API가 있다.
// AWS는 전 세계 장애가 섞여 있어서 서울 리전과 전역 서비스만 본다.

const STATUSPAGES = [
  { id: 'github', name: 'GitHub', url: 'https://www.githubstatus.com/api/v2/status.json', page: 'https://www.githubstatus.com' },
  { id: 'cloudflare', name: 'Cloudflare', url: 'https://www.cloudflarestatus.com/api/v2/status.json', page: 'https://www.cloudflarestatus.com' },
  { id: 'discord', name: 'Discord', url: 'https://discordstatus.com/api/v2/status.json', page: 'https://discordstatus.com' },
  { id: 'claude', name: 'Claude', url: 'https://status.anthropic.com/api/v2/status.json', page: 'https://status.anthropic.com' },
  { id: 'openai', name: 'OpenAI', url: 'https://status.openai.com/api/v2/status.json', page: 'https://status.openai.com' },
];
const AWS = { id: 'aws', name: 'AWS 서울', url: 'https://health.aws.amazon.com/public/currentevents', page: 'https://health.aws.amazon.com/health/status' };
const AWS_REGIONS = /ap-northeast-2|global/i;
const TIMEOUT_MS = 10000;

const LEVEL_TEXT = { none: '정상', minor: '일부 장애', major: '큰 장애', critical: '심각한 장애', maintenance: '점검 중' };

async function statuspage(s) {
  const res = await fetch(s.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
  const data = await res.json();
  const level = (data.status && data.status.indicator) || 'none';
  return { id: s.id, name: s.name, page: s.page, level, text: LEVEL_TEXT[level] || level, detail: (data.status && data.status.description) || '' };
}

// AWS 응답은 UTF-16(빅 엔디언일 때가 많다)이라 BOM을 보고 직접 푼다.
async function aws() {
  const res = await fetch(AWS.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const enc = bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8';
  let text = new TextDecoder(enc).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const events = (JSON.parse(text || '[]') || []).filter((e) => AWS_REGIONS.test(`${e.arn || ''} ${e.service || ''} ${e.region_name || ''}`));
  const level = events.length ? 'minor' : 'none';
  return {
    id: AWS.id, name: AWS.name, page: AWS.page, level, text: LEVEL_TEXT[level],
    detail: events.map((e) => e.summary || e.service_name).filter(Boolean).join(' / '),
  };
}

async function fetchStatus() {
  const jobs = [...STATUSPAGES.map((s) => statuspage(s)), aws()];
  const all = [...STATUSPAGES, AWS];
  const results = await Promise.allSettled(jobs);
  return results.map((r, i) => (r.status === 'fulfilled'
    ? r.value
    : { id: all[i].id, name: all[i].name, page: all[i].page, level: 'unknown', text: '확인 실패', detail: String((r.reason && r.reason.message) || r.reason) }));
}

module.exports = { fetchStatus };
