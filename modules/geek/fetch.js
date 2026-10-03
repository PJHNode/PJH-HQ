const { XMLParser } = require('fast-xml-parser');

// GeekNews(news.hada.io): 국내 개발자들이 고른 기술 뉴스. 한국어 요약이 함께 와서 번역이 필요 없다.
const FEED = 'https://news.hada.io/rss/news';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', trimValues: true });

function text(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v['#text'] || '');
  return String(v);
}

function stripHtml(html) {
  return text(html)
    .replace(/<\/(li|p|br)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\.{3}$/, '…')
    .trim();
}

function linkOf(entry) {
  const links = Array.isArray(entry.link) ? entry.link : [entry.link];
  const alt = links.find((l) => l && (l.rel === 'alternate' || !l.rel)) || links[0];
  return (alt && alt.href) || text(entry.id);
}

async function fetchGeekNews() {
  const res = await fetch(FEED, { headers: { 'User-Agent': 'PJH-Desk/2.0' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
  const data = parser.parse(await res.text());
  const entries = data && data.feed && data.feed.entry;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  return list.map((e) => {
    const title = text(e.title);
    const summary = stripHtml(e.content);
    return {
      title,
      link: linkOf(e),
      // 요약이 제목을 그대로 반복하는 글은 요약을 비운다.
      summary: summary && summary !== title ? summary : '',
      author: text(e.author && e.author.name),
      time: new Date(text(e.published) || text(e.updated)).getTime(),
    };
  });
}

module.exports = { fetchGeekNews };
