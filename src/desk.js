// PJH Desk 위젯 화면. 시계 · 날씨 · 오늘 할 일 · 헤드라인(BBC 한국/세계, Hacker News).
(function () {
  const api = window.api;
  const $ = (id) => document.getElementById(id);

  const NEWS_REFRESH_MS = 15 * 60 * 1000;
  const WEATHER_REFRESH_MS = 30 * 60 * 1000;
  const SHOW_FIRST = 8;
  const LOCATION_KEY = 'pjh-desk:weather:location';
  const TAB_KEY = 'pjh-desk:tab';

  // ---------- 도우미 ----------

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function timeAgo(ms) {
    if (!ms || Number.isNaN(ms)) return '';
    const min = Math.floor((Date.now() - ms) / 60000);
    if (min < 1) return '방금';
    if (min < 60) return `${min}분 전`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    return d === 1 ? '어제' : `${d}일 전`;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function errText(err) {
    return esc((err && err.message) || err || '알 수 없는 오류');
  }

  // ---------- 시계 ----------

  function tickClock() {
    const now = new Date();
    $('time').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    $('date').textContent = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  }

  // ---------- 날씨 ----------

  const WMO = {
    0: ['맑음', '☀️'], 1: ['대체로 맑음', '🌤️'], 2: ['구름 조금', '⛅'], 3: ['흐림', '☁️'],
    45: ['안개', '🌫️'], 48: ['짙은 안개', '🌫️'],
    51: ['약한 이슬비', '🌦️'], 53: ['이슬비', '🌦️'], 55: ['강한 이슬비', '🌦️'],
    61: ['약한 비', '🌧️'], 63: ['비', '🌧️'], 65: ['강한 비', '🌧️'],
    71: ['약한 눈', '🌨️'], 73: ['눈', '🌨️'], 75: ['강한 눈', '🌨️'],
    80: ['약한 소나기', '🌦️'], 81: ['소나기', '🌦️'], 82: ['강한 소나기', '⛈️'],
    95: ['뇌우', '⛈️'], 96: ['뇌우·우박', '⛈️'], 99: ['뇌우·우박', '⛈️'],
  };
  const wmo = (code) => WMO[code] || ['알 수 없음', '·'];

  let weatherLocation = readJson(LOCATION_KEY);
  let hoursOpen = false;

  async function loadWeather() {
    const body = $('weather-body');
    try {
      if (!weatherLocation) weatherLocation = await api.weather.detectLocation();
      const w = await api.weather.get(weatherLocation.latitude, weatherLocation.longitude);
      renderWeather(w);
    } catch (err) {
      body.innerHTML = `<div class="small error">날씨를 불러오지 못했어요: ${errText(err)}</div>
        <div class="wx-loc"><span class="link" id="wx-change">지역 직접 고르기</span></div>`;
      $('wx-change').addEventListener('click', openLocationSearch);
    }
  }

  function renderWeather(w) {
    const { current, hourly } = w;
    const [desc, emoji] = wmo(current.weather_code);

    // 오늘 최고/최저, 지금부터 8시간 예보
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const todayTemps = [];
    hourly.time.forEach((t, i) => { if (t.startsWith(today)) todayTemps.push(hourly.temperature_2m[i]); });
    const hi = todayTemps.length ? Math.round(Math.max(...todayTemps)) : null;
    const lo = todayTemps.length ? Math.round(Math.min(...todayTemps)) : null;

    const nowKey = `${today}T${pad(now.getHours())}:00`;
    let start = hourly.time.indexOf(nowKey);
    if (start < 0) start = 0;
    const hours = [];
    for (let i = start + 1; i < hourly.time.length && hours.length < 8; i++) {
      hours.push({
        hh: hourly.time[i].slice(11, 13),
        emoji: wmo(hourly.weather_code[i])[1],
        temp: Math.round(hourly.temperature_2m[i]),
        rain: hourly.precipitation_probability ? hourly.precipitation_probability[i] : null,
      });
    }

    $('weather-body').innerHTML = `
      <div class="wx-main" id="wx-main" title="눌러서 시간대별 예보 보기">
        <span class="wx-emoji">${emoji}</span>
        <span class="wx-temp">${Math.round(current.temperature_2m)}°</span>
        <div class="wx-side">
          <span class="wx-desc">${esc(desc)}</span>
          <span class="wx-range">${hi != null ? `최고 ${hi}° · 최저 ${lo}°` : ''} · 습도 ${esc(current.relative_humidity_2m)}%</span>
        </div>
      </div>
      <div class="wx-hours ${hoursOpen ? 'open' : ''}" id="wx-hours">
        ${hours.map((h) => `<div class="wx-hour">${h.hh}시<span class="e">${h.emoji}</span><b>${h.temp}°</b>${h.rain != null ? `${h.rain}%` : ''}</div>`).join('')}
      </div>
      <div class="wx-loc muted"><span class="link" id="wx-change" title="눌러서 지역 바꾸기">${esc(weatherLocation.name || '현재 위치')}</span></div>
    `;
    $('wx-main').addEventListener('click', () => {
      hoursOpen = !hoursOpen;
      $('wx-hours').classList.toggle('open', hoursOpen);
    });
    $('wx-change').addEventListener('click', openLocationSearch);
  }

  function openLocationSearch() {
    const loc = document.querySelector('#weather .wx-loc');
    loc.innerHTML = `
      <div class="wx-search">
        <input id="wx-q" placeholder="지역 이름 (예: 부산, Tokyo)">
        <button class="link small" id="wx-me">내 위치</button>
      </div>
      <ul class="wx-results" id="wx-results"></ul>`;
    const input = $('wx-q');
    input.focus();
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') { loadWeather(); return; }
      if (e.key !== 'Enter' || !input.value.trim()) return;
      const results = $('wx-results');
      results.innerHTML = '<li class="small">검색 중...</li>';
      try {
        const found = await api.weather.search(input.value.trim());
        if (!found.length) { results.innerHTML = '<li class="small">결과가 없어요</li>'; return; }
        results.innerHTML = found.map((r, i) => `<li data-i="${i}">${esc(r.name)}</li>`).join('');
        results.querySelectorAll('li').forEach((li) => li.addEventListener('click', () => {
          weatherLocation = found[Number(li.dataset.i)];
          localStorage.setItem(LOCATION_KEY, JSON.stringify(weatherLocation));
          loadWeather();
        }));
      } catch (err) {
        results.innerHTML = `<li class="small error">검색 실패: ${errText(err)}</li>`;
      }
    });
    $('wx-me').addEventListener('click', () => {
      localStorage.removeItem(LOCATION_KEY);
      weatherLocation = null;
      loadWeather();
    });
  }

  // ---------- 오늘 할 일 ----------

  function renderTodo(items) {
    const left = items.filter((it) => !it.done).length;
    $('todo-count').textContent = items.length ? `${left}개 남음` : '';
    $('todo-list').innerHTML = items.map((it) => `
      <li class="todo-item ${it.done ? 'done' : ''}" data-id="${esc(it.id)}">
        <button class="todo-check" data-act="toggle" title="완료"></button>
        <span class="todo-text" data-act="toggle">${esc(it.text)}</span>
        <button class="todo-del" data-act="remove" title="삭제">×</button>
      </li>`).join('');
  }

  async function loadTodo() {
    renderTodo(await api.todo.list());
  }

  $('todo-list').addEventListener('click', async (e) => {
    const act = e.target.dataset.act;
    const li = e.target.closest('.todo-item');
    if (!act || !li) return;
    renderTodo(act === 'toggle' ? await api.todo.toggle(li.dataset.id) : await api.todo.remove(li.dataset.id));
  });

  $('todo-input').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || e.isComposing) return; // 한글 조합 중 Enter는 무시
    const input = e.target;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    renderTodo(await api.todo.add(text));
  });

  // ---------- 헤드라인 ----------

  let tab = localStorage.getItem(TAB_KEY) || 'korea';
  let expanded = false;
  const feeds = { korea: null, world: null, hn: null };
  const feedErrors = { korea: null, world: null, hn: null };

  function setTab(next) {
    tab = next;
    expanded = false;
    localStorage.setItem(TAB_KEY, tab);
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    renderNews();
    $('news-list').scrollTop = 0;
  }

  function bbcItem(it, translated) {
    const t = it.pubDate ? new Date(it.pubDate).getTime() : NaN;
    return `
      <div class="item">
        <div class="item-title">${esc(it.title)}</div>
        ${translated && it.titleKo ? `<div class="item-ko">${esc(it.titleKo)}</div>` : ''}
        <div class="item-meta">${esc(timeAgo(t))}</div>
        <div class="item-detail">
          ${esc(it.description) || '요약이 없어요.'}
          <div class="item-links"><span class="link" data-url="${esc(it.link)}">원문 보기 →</span></div>
        </div>
      </div>`;
  }

  function hnItem(it) {
    return `
      <div class="item">
        <div class="item-title">${esc(it.title)}</div>
        ${it.titleKo ? `<div class="item-ko">${esc(it.titleKo)}</div>` : ''}
        <div class="item-meta">${esc(it.site)} · ▲ ${it.points} · 댓글 ${it.comments} · ${esc(timeAgo(it.time))}</div>
        <div class="item-detail">
          <div class="item-links">
            <span class="link" data-url="${esc(it.url)}">원문 →</span>
            <span class="link" data-url="${esc(it.commentsUrl)}">댓글 ${it.comments}개 →</span>
          </div>
        </div>
      </div>`;
  }

  function renderNews() {
    const list = $('news-list');
    const items = feeds[tab];
    if (feedErrors[tab]) {
      list.innerHTML = `<div class="small error">불러오지 못했어요: ${esc(feedErrors[tab])}</div>`;
      return;
    }
    if (!items) {
      list.innerHTML = '<div class="muted small">불러오는 중...</div>';
      return;
    }
    if (!items.length) {
      list.innerHTML = '<div class="muted small">최근 기사가 없어요.</div>';
      return;
    }
    const shown = expanded ? items : items.slice(0, SHOW_FIRST);
    const html = shown.map((it) => (tab === 'hn' ? hnItem(it) : bbcItem(it, tab === 'world'))).join('');
    const more = !expanded && items.length > SHOW_FIRST ? `<button class="more" id="more">${items.length - SHOW_FIRST}개 더 보기</button>` : '';
    list.innerHTML = html + more;
    if (more) $('more').addEventListener('click', () => { expanded = true; renderNews(); });
  }

  $('news-list').addEventListener('click', (e) => {
    const link = e.target.closest('[data-url]');
    if (link) {
      e.stopPropagation();
      const url = link.dataset.url;
      if (url) api.openExternal(url);
      return;
    }
    const item = e.target.closest('.item');
    if (item) item.classList.toggle('open');
  });

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  async function loadNews() {
    const [bbc, hn] = await Promise.allSettled([api.getNews(), api.getHackerNews()]);
    if (bbc.status === 'fulfilled') {
      feeds.korea = bbc.value.korea;
      feeds.world = bbc.value.world;
      feedErrors.korea = bbc.value.errors && bbc.value.errors.korea;
      feedErrors.world = bbc.value.errors && bbc.value.errors.world;
    } else {
      feedErrors.korea = feedErrors.world = String((bbc.reason && bbc.reason.message) || bbc.reason);
    }
    if (hn.status === 'fulfilled') {
      feeds.hn = hn.value.items;
      feedErrors.hn = null;
    } else {
      feedErrors.hn = String((hn.reason && hn.reason.message) || hn.reason);
    }
    renderNews();
    const now = new Date();
    $('updated').textContent = `업데이트 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  // ---------- 위쪽 버튼 ----------

  function showPinned(pinned) {
    $('btn-pin').classList.toggle('on', pinned);
    $('btn-pin').title = pinned ? '항상 위에 두기 (켜짐)' : '항상 위에 두기';
  }

  $('btn-pin').addEventListener('click', async () => showPinned(await api.desk.togglePin()));
  $('btn-hide').addEventListener('click', () => api.desk.hide());
  $('btn-refresh').addEventListener('click', refreshAll);
  api.desk.onPinned(showPinned);
  api.desk.onRefresh(refreshAll);

  function refreshAll() {
    loadWeather();
    loadNews();
    loadTodo();
  }

  // ---------- 시작 ----------

  tickClock();
  setInterval(tickClock, 1000);
  setTab(tab);
  api.desk.getPinned().then(showPinned);
  refreshAll();
  setInterval(loadNews, NEWS_REFRESH_MS);
  setInterval(loadWeather, WEATHER_REFRESH_MS);
  // 자정이 지나면 어제 끝낸 일을 정리한다.
  setInterval(loadTodo, 10 * 60 * 1000);
})();
