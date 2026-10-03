const { translateMany } = require('../news/translate');

// Hacker News 첫 페이지. 공식 API(Firebase)로 실제 순위를 받고, 실패하면 Algolia 검색 API로 대신 받는다.
const FIREBASE = 'https://hacker-news.firebaseio.com/v0';
const ALGOLIA_FRONT = 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30';
const COUNT = 30;
const TIMEOUT_MS = 10000;

function itemPage(id) {
  return `https://news.ycombinator.com/item?id=${id}`;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PJH-Desk/2.0' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
  return res.json();
}

async function fromFirebase() {
  const ids = (await getJson(`${FIREBASE}/topstories.json`)).slice(0, COUNT);
  const results = await Promise.allSettled(ids.map((id) => getJson(`${FIREBASE}/item/${id}.json`)));
  return results
    .filter((r) => r.status === 'fulfilled' && r.value && !r.value.deleted && !r.value.dead)
    .map((r) => {
      const it = r.value;
      return {
        id: it.id,
        title: it.title || '',
        url: it.url || itemPage(it.id),
        site: it.url ? hostOf(it.url) : 'news.ycombinator.com',
        points: it.score || 0,
        comments: it.descendants || 0,
        commentsUrl: itemPage(it.id),
        time: (it.time || 0) * 1000,
      };
    });
}

async function fromAlgolia() {
  const data = await getJson(ALGOLIA_FRONT);
  return (data.hits || []).map((h) => ({
    id: Number(h.objectID),
    title: h.title || '',
    url: h.url || itemPage(h.objectID),
    site: h.url ? hostOf(h.url) : 'news.ycombinator.com',
    points: h.points || 0,
    comments: h.num_comments || 0,
    commentsUrl: itemPage(h.objectID),
    time: (h.created_at_i || 0) * 1000,
  }));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function fetchHackerNews() {
  let items;
  let source = 'firebase';
  try {
    items = await fromFirebase();
    if (items.length === 0) throw new Error('빈 응답');
  } catch {
    source = 'algolia';
    items = await fromAlgolia();
  }

  const translated = await translateMany(items.map((it) => it.title));
  return { source, items: items.map((it, i) => ({ ...it, titleKo: translated[i] })) };
}

module.exports = { fetchHackerNews };
