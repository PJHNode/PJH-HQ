const { XMLParser } = require('fast-xml-parser');
const { translateToKorean } = require('./translate');

const FEEDS = {
  korea: 'https://feeds.bbci.co.uk/korean/rss.xml',
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
};

// [라벨, 최대 경과 시간(시간)] 순서대로 검사 - 가장 먼저 맞는 구간이 해당 기사의 버킷
const BUCKETS = [
  ['6시간 이내', 6],
  ['하루 이내', 24],
  ['2일 이내', 48],
  ['3일 이내', 72],
  ['1주 이내', 168],
];

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

function stripHtml(text) {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').trim();
}

function getBucket(ageHours) {
  const found = BUCKETS.find(([, maxHours]) => ageHours <= maxHours);
  return found ? found[0] : null;
}

async function fetchFeed(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PJH-News-Desktop/1.0' },
  });
  if (!res.ok) {
    throw new Error(`피드 요청 실패 (${res.status})`);
  }
  const xml = await res.text();
  const data = parser.parse(xml);
  const items = data?.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];

  return list.map((item) => ({
    title: stripHtml(item.title),
    link: typeof item.link === 'string' ? item.link : '',
    description: stripHtml(item.description),
    pubDate: item.pubDate || '',
  }));
}

// 1주가 넘은(오래된 고정성) 기사는 제외하고, 최신순 정렬 + 경과시간 구간(bucket) 부여
function annotateAndFilter(items) {
  const now = Date.now();
  return items
    .map((item) => {
      const t = item.pubDate ? new Date(item.pubDate).getTime() : NaN;
      const ageHours = Number.isNaN(t) ? Infinity : (now - t) / 3600000;
      return { ...item, ageHours, bucket: getBucket(ageHours) };
    })
    .filter((item) => item.bucket !== null)
    .sort((a, b) => a.ageHours - b.ageHours);
}

async function withTranslations(items) {
  if (items.length === 0) return items;
  const results = await Promise.allSettled(items.map((item) => translateToKorean(item.title)));
  return items.map((item, i) => ({
    ...item,
    titleKo: results[i].status === 'fulfilled' ? results[i].value : '',
  }));
}

async function fetchTodayNews() {
  const [koreaResult, worldResult] = await Promise.allSettled([
    fetchFeed(FEEDS.korea),
    fetchFeed(FEEDS.world),
  ]);

  const korea = koreaResult.status === 'fulfilled' ? annotateAndFilter(koreaResult.value) : [];
  const world = worldResult.status === 'fulfilled'
    ? await withTranslations(annotateAndFilter(worldResult.value))
    : [];

  return {
    korea,
    world,
    bucketOrder: BUCKETS.map(([label]) => label),
    errors: {
      korea: koreaResult.status === 'rejected' ? String(koreaResult.reason.message || koreaResult.reason) : null,
      world: worldResult.status === 'rejected' ? String(worldResult.reason.message || worldResult.reason) : null,
    },
  };
}

module.exports = { fetchTodayNews };
