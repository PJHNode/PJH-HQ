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

function groupByBucket(items, bucketOrder) {
  const groups = {};
  bucketOrder.forEach((b) => { groups[b] = []; });
  items.forEach((item) => {
    if (groups[item.bucket]) groups[item.bucket].push(item);
  });
  return groups;
}

function renderItem(item, showTranslation) {
  return `
    <li class="news-item" data-index="${item.link ? escapeHtml(item.link) : ''}">
      <div class="news-item-title">
        <span class="t">
          <span class="orig">${escapeHtml(item.title)}</span>
          ${showTranslation ? `<span class="ko-trans">${escapeHtml(item.titleKo) || '&nbsp;'}</span>` : ''}
        </span>
        <span class="date">${escapeHtml(formatDate(item.pubDate))}</span>
      </div>
      <div class="news-item-detail">
        <p>${escapeHtml(item.description) || '요약 정보가 없습니다.'}</p>
        <a href="#" data-link="${escapeHtml(item.link)}">원문 보기 →</a>
      </div>
    </li>`;
}

function renderSection(items, bucketOrder, showTranslation) {
  if (!items || items.length === 0) {
    return '<div class="state-msg">최근 1주 이내 기사가 없습니다.</div>';
  }
  const groups = groupByBucket(items, bucketOrder);
  return bucketOrder
    .filter((label) => groups[label].length > 0)
    .map(
      (label) => `
        <div class="bucket-group">
          <h3 class="bucket-label">${escapeHtml(label)}</h3>
          <ul class="news-list">${groups[label].map((item) => renderItem(item, showTranslation)).join('')}</ul>
        </div>`
    )
    .join('');
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
    <div class="page-sub">BBC 한국 / 세계 뉴스 (최근 1주 이내, 경과 시간순)</div>
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
      const bucketOrder = data.bucketOrder || ['6시간 이내', '하루 이내', '2일 이내', '3일 이내', '1주 이내'];

      sections.innerHTML = `
        <div class="news-section">
          <h2>한국</h2>
          ${koreaError ? `<div class="state-msg error">한국 뉴스를 불러오지 못했습니다: ${escapeHtml(koreaError)}</div>` : renderSection(data.korea, bucketOrder, false)}
        </div>
        <div class="news-section">
          <h2>세계 <span class="section-hint">(오른쪽: 한국어 번역)</span></h2>
          ${worldError ? `<div class="state-msg error">세계 뉴스를 불러오지 못했습니다: ${escapeHtml(worldError)}</div>` : renderSection(data.world, bucketOrder, true)}
        </div>
      `;
      attachNewsListHandlers(sections);
    })
    .catch((err) => {
      sections.innerHTML = `<div class="state-msg error">뉴스를 불러오는 중 오류가 발생했습니다: ${escapeHtml(err.message || err)}</div>`;
    });
};
