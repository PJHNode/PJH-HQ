const { translateMany } = require('../news/translate');

// 미국 CISA "실제로 공격에 쓰이고 있다고 확인된 취약점(KEV)" 목록에서 최근 추가분을 가져온다.
// 파일이 1MB가 넘어서 6시간 동안은 받아 둔 것을 다시 쓴다.
const FEED = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const COUNT = 20;
const CACHE_MS = 6 * 60 * 60 * 1000;

let cache = null;

async function download() {
  const res = await fetch(FEED, { headers: { 'User-Agent': 'PJH-Desk/2.0' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
  const data = await res.json();
  return (data.vulnerabilities || [])
    .slice()
    .sort((a, b) => String(b.dateAdded).localeCompare(String(a.dateAdded)) || String(b.cveID).localeCompare(String(a.cveID)))
    .slice(0, COUNT)
    .map((v) => ({
      cve: v.cveID,
      vendor: v.vendorProject,
      product: v.product,
      name: v.vulnerabilityName,
      description: v.shortDescription,
      added: v.dateAdded,
      dueDate: v.dueDate,
      ransomware: String(v.knownRansomwareCampaignUse || '').toLowerCase() === 'known',
      link: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(v.cveID)}`,
    }));
}

async function fetchKev() {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), items: await download() };
  const items = cache.items;
  // 이름과 설명을 함께 묶어 번역한다(실패하면 영어 원문만 보여준다).
  const translated = await translateMany([...items.map((v) => v.name), ...items.map((v) => v.description)]);
  return items.map((v, i) => ({ ...v, nameKo: translated[i], descriptionKo: translated[items.length + i] }));
}

module.exports = { fetchKev };
