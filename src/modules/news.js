window.PJHPages = window.PJHPages || {};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return pubDate;
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderNewsList(items) {
  if (!items || items.length === 0) {
    return '<div class="state-msg">표시할 기사가 없습니다.</div>';
  }
  return `<ul class="news-list">${items
    .map(
      (item, i) => `
      <li class="news-item" data-index="${i}">
        <div class="news-item-title">
          <span class="t">${escapeHtml(item.title)}</span>
          <span class="date">${escapeHtml(formatDate(item.pubDate))}</span>
        </div>
        <div class="news-item-detail">
          <p>${escapeHtml(item.description) || '요약 정보가 없습니다.'}</p>
          <a href="#" data-link="${escapeHtml(item.link)}">원문 보기 →</a>
        </div>
      </li>`
    )
    .join('')}</ul>`;
}

function attachNewsListHandlers(container) {
  container.querySelectorAll('.news-item-title').forEach((titleEl) => {
    titleEl.addEventListener('click', () => {
      const item = titleEl.closest('.news-item');
      item.classList.toggle('open');
    });
  });
  container.querySelectorAll('[data-link]').forEach((linkEl) => {
    linkEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = linkEl.getAttribute('data-link');
      if (url) window.api.openExternal(url);
    });
  });
}

PJHPages.news = function renderNews(container) {
  container.innerHTML = `
    <div class="page-title">오늘의 뉴스</div>
    <div class="page-sub">BBC 한국 / 세계 뉴스</div>
    <div class="news-sections" id="news-sections">
      <div class="state-msg">불러오는 중...</div>
    </div>
  `;

  const sections = container.querySelector('#news-sections');

  window.api
    .getNews()
    .then((data) => {
      const koreaError = data.errors && data.errors.korea;
      const worldError = data.errors && data.errors.world;

      sections.innerHTML = `
        <div class="news-section">
          <h2>한국</h2>
          ${koreaError ? `<div class="state-msg error">한국 뉴스를 불러오지 못했습니다: ${escapeHtml(koreaError)}</div>` : renderNewsList(data.korea)}
        </div>
        <div class="news-section">
          <h2>세계</h2>
          ${worldError ? `<div class="state-msg error">세계 뉴스를 불러오지 못했습니다: ${escapeHtml(worldError)}</div>` : renderNewsList(data.world)}
        </div>
      `;
      attachNewsListHandlers(sections);
    })
    .catch((err) => {
      sections.innerHTML = `<div class="state-msg error">뉴스를 불러오는 중 오류가 발생했습니다: ${escapeHtml(err.message || err)}</div>`;
    });
};
