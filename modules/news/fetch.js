const { XMLParser } = require('fast-xml-parser');

const FEEDS = {
  korea: 'https://feeds.bbci.co.uk/korean/rss.xml',
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

function stripHtml(text) {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').trim();
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

async function fetchTodayNews() {
  const [koreaResult, worldResult] = await Promise.allSettled([
    fetchFeed(FEEDS.korea),
    fetchFeed(FEEDS.world),
  ]);

  return {
    korea: koreaResult.status === 'fulfilled' ? koreaResult.value : [],
    world: worldResult.status === 'fulfilled' ? worldResult.value : [],
    errors: {
      korea: koreaResult.status === 'rejected' ? String(koreaResult.reason.message || koreaResult.reason) : null,
      world: worldResult.status === 'rejected' ? String(worldResult.reason.message || worldResult.reason) : null,
    },
  };
}

module.exports = { fetchTodayNews };
