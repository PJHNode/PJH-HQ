// PJH Desk 위젯 화면. 시계 · 날씨 · 시스템 · 오늘 할 일 · 헤드라인(BBC 한국/세계, GeekNews, Hacker News, 보안).
(function () {
  const api = window.api;
  const $ = (id) => document.getElementById(id);

  const NEWS_REFRESH_MS = 15 * 60 * 1000;
  const WEATHER_REFRESH_MS = 30 * 60 * 1000;
  const SYS_REFRESH_MS = 2000;
  const NET_REFRESH_MS = 5000;
  const STATUS_REFRESH_MS = 5 * 60 * 1000;
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
        <span class="link wx-place" id="wx-change" title="눌러서 지역 바꾸기">${esc(weatherLocation.name || '현재 위치')}</span>
      </div>
      <div class="wx-hours ${hoursOpen ? 'open' : ''}" id="wx-hours">
        ${hours.map((h) => `<div class="wx-hour">${h.hh}시<span class="e">${h.emoji}</span><b>${h.temp}°</b>${h.rain != null ? `${h.rain}%` : ''}</div>`).join('')}
      </div>
      <div class="wx-loc"></div>
    `;
    $('wx-main').addEventListener('click', (e) => {
      if (e.target.closest('#wx-change')) return; // 지역 이름을 누른 건 예보 펼치기가 아니다
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
  if (!['korea', 'world', 'geek', 'hn', 'kev'].includes(tab)) tab = 'korea';
  let expanded = false;
  const feeds = { korea: null, world: null, geek: null, hn: null, kev: null };
  const feedErrors = { korea: null, world: null, geek: null, hn: null, kev: null };
  const TAB_RENDER = {
    korea: (it) => bbcItem(it, false),
    world: (it) => bbcItem(it, true),
    geek: (it) => geekItem(it),
    hn: (it) => hnItem(it),
    kev: (it) => kevItem(it),
  };

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
    const html = shown.map(TAB_RENDER[tab]).join('');
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

  function settle(key, result, pick) {
    if (result.status === 'fulfilled') {
      feeds[key] = pick(result.value);
      feedErrors[key] = null;
    } else {
      feedErrors[key] = String((result.reason && result.reason.message) || result.reason);
    }
  }

  async function loadNews() {
    const [bbc, hn, geek, kev] = await Promise.allSettled([api.getNews(), api.getHackerNews(), api.getGeekNews(), api.getKev()]);
    settle('geek', geek, (v) => v);
    settle('kev', kev, (v) => v);
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

  function geekItem(it) {
    return `
      <div class="item">
        <div class="item-title">${esc(it.title)}</div>
        <div class="item-meta">${esc(timeAgo(it.time))}${it.author ? ` · ${esc(it.author)}` : ''}</div>
        <div class="item-detail">
          ${it.summary ? esc(it.summary) : ''}
          <div class="item-links"><span class="link" data-url="${esc(it.link)}">GeekNews에서 보기 →</span></div>
        </div>
      </div>`;
  }

  function kevItem(it) {
    const name = it.nameKo || it.name;
    const desc = it.descriptionKo || it.description;
    return `
      <div class="item">
        <div class="cve">${esc(it.cve)} · ${esc(it.vendor)} ${esc(it.product)}${it.ransomware ? '<span class="badge ransom">랜섬웨어</span>' : ''}</div>
        <div class="item-title">${esc(name)}</div>
        <div class="item-meta">추가 ${esc(it.added)}${it.dueDate ? ` · 조치 기한 ${esc(it.dueDate)}` : ''}</div>
        <div class="item-detail">
          ${esc(desc)}
          ${it.nameKo ? `<div class="item-ko gap">${esc(it.name)}</div>` : ''}
          <div class="item-links"><span class="link" data-url="${esc(it.link)}">NVD에서 보기 →</span></div>
        </div>
      </div>`;
  }

  // ---------- 시스템: 내 PC ----------

  function fmtBytes(n, digits = 1) {
    if (n == null || Number.isNaN(n)) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
  }

  function meter(key, label, value, percent, level) {
    const pct = Math.max(0, Math.min(100, percent || 0));
    return `
      <div class="meter ${level || ''}" data-meter="${key}">
        <div class="meter-top"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>
        <div class="meter-bar"><div class="meter-fill" data-pct="${pct.toFixed(1)}"></div></div>
      </div>`;
  }

  let battery = null;
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      // 배터리가 없는 데스크톱은 "항상 100% 충전 중"으로 나온다. 그 경우는 숨긴다.
      if (b.charging && b.level === 1 && b.chargingTime === 0) return;
      battery = b;
    }).catch(() => {});
  }

  async function loadSystem() {
    let s;
    try {
      s = await api.sys.sample();
    } catch {
      return;
    }
    const cells = [];
    cells.push(s.cpu == null
      ? meter('cpu', 'CPU', '…', 0)
      : meter('cpu', 'CPU', `${s.cpu}%`, s.cpu, s.cpu >= 90 ? 'bad' : s.cpu >= 70 ? 'warn' : ''));
    const memPct = (s.mem.used / s.mem.total) * 100;
    cells.push(meter('mem', '메모리', `${fmtBytes(s.mem.used)} / ${fmtBytes(s.mem.total, 0)}`, memPct, memPct >= 90 ? 'bad' : memPct >= 80 ? 'warn' : ''));
    if (s.disk) {
      const usedPct = (1 - s.disk.free / s.disk.total) * 100;
      const freePct = 100 - usedPct;
      cells.push(meter('disk', `디스크 ${s.disk.name}`, `${fmtBytes(s.disk.free)} 남음`, usedPct, freePct < 5 ? 'bad' : freePct < 10 ? 'warn' : ''));
    }
    if (battery) {
      const lv = Math.round(battery.level * 100);
      cells.push(meter('bat', '배터리', `${lv}%${battery.charging ? ' 충전 중' : ''}`, lv, !battery.charging && lv <= 10 ? 'bad' : !battery.charging && lv <= 20 ? 'warn' : ''));
    } else {
      const h = Math.floor(s.uptime / 3600);
      const m = Math.floor((s.uptime % 3600) / 60);
      cells.push(`<div class="meter"><div class="meter-top"><span class="k">켜진 시간</span><span class="v">${h ? `${h}시간 ` : ''}${m}분</span></div></div>`);
    }
    $('sys-meters').innerHTML = cells.join('');
    // 화면 보안 정책(CSP)이 인라인 style 속성을 막아서 막대 길이는 스크립트로 지정한다.
    document.querySelectorAll('#sys-meters .meter-fill').forEach((el) => { el.style.width = `${el.dataset.pct}%`; });
    if (s.net) netRate = s.net;
    renderNetRate();
  }

  // ---------- 시스템: 네트워크 ----------

  let netRate = null;
  let showPublicIp = false;
  let lastNet = null;

  function sparkline(series) {
    const W = 110;
    const H = 20;
    const all = series.flat().filter((v) => v != null);
    const max = Math.max(50, ...all);
    const n = Math.max(2, ...series.map((s) => s.length));
    const x = (i) => (i / (n - 1)) * (W - 2) + 1;
    const y = (v) => H - 2 - (v / max) * (H - 4);
    let out = '';
    series.forEach((s, si) => {
      // 측정 실패(null)는 선을 끊고, 1.1.1.1 쪽은 빨간 점으로 표시한다.
      const parts = [];
      let cur = [];
      s.forEach((v, i) => {
        if (v == null) {
          if (cur.length) parts.push(cur);
          cur = [];
          if (si === 0) out += `<circle class="drop" cx="${x(i).toFixed(1)}" cy="${H - 3}" r="1.5"/>`;
        } else {
          cur.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
        }
      });
      if (cur.length) parts.push(cur);
      parts.forEach((p) => { out += `<polyline class="s${si}" points="${p.length === 1 ? `${p[0]} ${p[0]}` : p.join(' ')}"/>`; });
    });
    return `<svg class="spark" viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function maskIp(ip) {
    return String(ip).replace(/\d+/g, '•••');
  }

  function renderNetRate() {
    const el = document.getElementById('net-rate');
    if (el) el.textContent = netRate ? `↓ ${fmtBytes(netRate.down)}/s   ↑ ${fmtBytes(netRate.up)}/s` : '…';
  }

  function renderNet() {
    const n = lastNet;
    if (!n) return;
    const link = n.link || {};
    const linkText = link.type === 'wifi'
      ? `와이파이 ${link.ssid || ''}${link.signal != null ? ` · 신호 ${link.signal}%` : ''}`
      : link.type === 'wired' ? '유선 연결' : '연결 없음';
    const vals = n.latency.map((l) => {
      const v = l.history.length ? l.history[l.history.length - 1] : undefined;
      const shown = v === undefined ? '…' : v == null ? '끊김' : `${v}ms`;
      return `<span>${esc(l.label)} <b>${esc(shown)}</b></span>`;
    }).join('');
    const pub = n.publicIp
      ? (showPublicIp ? `<span class="link" id="ip-toggle" title="눌러서 가리기">${esc(n.publicIp)}</span>`
        : `<span class="ip-hidden" id="ip-toggle" title="눌러서 보기">${esc(maskIp(n.publicIp))}</span>`)
      : '<span class="muted">-</span>';
    $('sys-net').innerHTML = `
      <div class="net-row"><span class="k">${esc(linkText)}</span><span class="v" id="net-rate"></span></div>
      <div class="net-row"><div class="lat-vals">${vals}</div>${sparkline(n.latency.map((l) => l.history))}</div>
      <div class="net-row"><span class="k">IP ${esc(n.local ? n.local.address : '-')}</span><span class="v">공인 ${pub}</span></div>`;
    renderNetRate();
    const t = document.getElementById('ip-toggle');
    if (t) t.addEventListener('click', () => { showPublicIp = !showPublicIp; renderNet(); });
  }

  async function loadNet() {
    try {
      lastNet = await api.sys.net();
      renderNet();
    } catch (err) {
      $('sys-net').innerHTML = `<div class="small error">네트워크 정보를 읽지 못했어요: ${errText(err)}</div>`;
    }
  }

  // ---------- 시스템: 서비스 상태 ----------

  async function loadStatus() {
    let list;
    try {
      list = await api.sys.status();
    } catch {
      return;
    }
    const problems = list.filter((s) => s.level !== 'none' && s.level !== 'unknown');
    const unknown = list.filter((s) => s.level === 'unknown');
    const el = $('sys-status');
    if (!problems.length) {
      el.innerHTML = `<div class="svc-ok" title="${esc(list.map((s) => `${s.name}: ${s.text}`).join('\n'))}">
        <span class="dot inline"></span>서비스 모두 정상 · ${esc(list.filter((s) => s.level === 'none').map((s) => s.name).join(' · '))}${unknown.length ? ` (${esc(unknown.map((s) => s.name).join(', '))} 확인 실패)` : ''}</div>`;
      return;
    }
    el.innerHTML = problems.map((s) => `
      <div class="svc-item ${esc(s.level)}" data-url="${esc(s.page)}" title="${esc(s.detail)}">
        <span class="dot ${esc(s.level)}"></span><span class="svc-name">${esc(s.name)}</span><span class="svc-text">${esc(s.text)}</span>
      </div>`).join('') + `<div class="svc-ok">나머지 ${list.length - problems.length - unknown.length}곳 정상</div>`;
  }

  $('sys-status').addEventListener('click', (e) => {
    const item = e.target.closest('[data-url]');
    if (item) api.openExternal(item.dataset.url);
  });

  // ---------- 지금 재생 중 ----------

  const ICON_PAUSE = '<svg viewBox="0 0 16 16"><path d="M5 3v10M11 3v10"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M5 3l8 5-8 5z" fill="currentColor"/></svg>';

  function appName(id) {
    const s = String(id || '').toLowerCase();
    if (!s) return '';
    if (s.includes('spotify')) return 'Spotify';
    if (s.includes('msedge')) return 'Edge';
    if (s.includes('chrome')) return 'Chrome';
    if (s.includes('firefox') || s.includes('308046b0af4a39cb')) return 'Firefox';
    if (s.includes('whale')) return 'Whale';
    if (s.includes('zunemusic') || s.includes('media.player')) return '미디어 플레이어';
    if (s.includes('vlc')) return 'VLC';
    return String(id).split(/[\\/!]/).pop().replace(/\.exe$/i, '');
  }

  async function loadMedia() {
    let m;
    try {
      m = await api.media.get();
    } catch {
      return;
    }
    const box = $('now-playing');
    if (!m || m.status === 'none' || !m.title) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    box.classList.toggle('paused', !m.playing);
    $('np-title').textContent = m.title;
    $('np-sub').textContent = [m.artist, appName(m.app)].filter(Boolean).join(' · ');
    $('np-toggle').innerHTML = m.playing ? ICON_PAUSE : ICON_PLAY;
    $('np-toggle').title = m.playing ? '일시정지' : '재생';
    box.querySelector('[data-media="prev"]').disabled = !m.canPrev;
    box.querySelector('[data-media="next"]').disabled = !m.canNext;
  }

  $('now-playing').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-media]');
    if (!btn || btn.disabled) return;
    await api.media.command(btn.dataset.media);
    setTimeout(loadMedia, 400);
  });

  // ---------- 집중 타이머 ----------

  const FOCUS_KEY = 'pjh-desk:focus';
  const FOCUS_COUNT_KEY = 'pjh-desk:focus-count';
  const FOCUS_MS = 25 * 60 * 1000;
  const BREAK_MS = 5 * 60 * 1000;

  // 위젯을 다시 켜도 이어지도록 끝나는 시각을 저장해 둔다.
  let focus = readJson(FOCUS_KEY) || { mode: 'focus', running: false, endAt: null, remainMs: FOCUS_MS };

  function saveFocus() {
    localStorage.setItem(FOCUS_KEY, JSON.stringify(focus));
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function focusCount() {
    const c = readJson(FOCUS_COUNT_KEY);
    return c && c.date === todayStr() ? c.n : 0;
  }

  function addFocusCount() {
    localStorage.setItem(FOCUS_COUNT_KEY, JSON.stringify({ date: todayStr(), n: focusCount() + 1 }));
  }

  function focusLeft() {
    return focus.running ? Math.max(0, focus.endAt - Date.now()) : focus.remainMs;
  }

  function finishPhase() {
    if (focus.mode === 'focus') {
      addFocusCount();
      api.focus.notify('focus-over');
      focus = { mode: 'break', running: true, endAt: Date.now() + BREAK_MS, remainMs: BREAK_MS };
    } else {
      api.focus.notify('break-over');
      focus = { mode: 'focus', running: false, endAt: null, remainMs: FOCUS_MS };
    }
    saveFocus();
  }

  function tickFocus() {
    if (focus.running && focusLeft() <= 0) finishPhase();
    const left = focusLeft();
    const sec = Math.ceil(left / 1000);
    const el = $('focus-time');
    el.textContent = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
    el.classList.toggle('break', focus.mode === 'break');
    $('focus').querySelector('.label').firstChild.nodeValue = focus.mode === 'break' ? '휴식 ' : '집중 ';
    const full = focus.mode === 'break' ? BREAK_MS : FOCUS_MS;
    $('focus-start').textContent = focus.running ? '일시정지' : (left < full ? '계속' : '시작');
    const n = focusCount();
    $('focus-count').textContent = n ? `오늘 ${n}회` : '';
  }

  $('focus-start').addEventListener('click', () => {
    if (focus.running) {
      focus.remainMs = focusLeft();
      focus.running = false;
      focus.endAt = null;
    } else {
      focus.endAt = Date.now() + focus.remainMs;
      focus.running = true;
    }
    saveFocus();
    tickFocus();
  });

  $('focus-reset').addEventListener('click', () => {
    focus = { mode: 'focus', running: false, endAt: null, remainMs: FOCUS_MS };
    saveFocus();
    tickFocus();
  });

  // ---------- 자리 비움 (PJH-LOCK) ----------

  function fmtDuration(ms) {
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min}분`;
    return `${Math.floor(min / 60)}시간 ${min % 60}분`;
  }

  let lockNotice = '';

  async function loadLock() {
    let s = null;
    try {
      s = await api.lock.summary();
    } catch {
      s = null;
    }
    if (!s) {
      $('lock-sum').innerHTML = '<span class="muted small">PJH-LOCK 기록이 없어요</span>';
      $('lock-warn').textContent = lockNotice;
      return;
    }
    $('lock-sum').innerHTML = s.locks
      ? `<b>${s.locks}</b>번 · ${esc(fmtDuration(s.awayMs))}`
      : '<span class="muted small">오늘은 아직 없어요</span>';
    const warn = [];
    if (s.failures) warn.push(`비밀번호 실패 ${s.failures}번`);
    if (s.osLocks) warn.push(`Windows 잠금 전환 ${s.osLocks}번`);
    if (s.incidents) warn.push(`강제 종료 ${s.incidents}번`);
    $('lock-warn').textContent = lockNotice || warn.join(' · ');
    $('lock-warn').title = '오늘 PJH-LOCK 기록 (트레이 → 기록 보기에서 자세히)';
  }

  $('lock-now').addEventListener('click', async () => {
    const r = await api.lock.now();
    if (r.via === 'system' && r.reason === 'old-pjh-lock') lockNotice = 'PJH-LOCK을 새 버전으로 바꾸면 PJH-LOCK 화면으로 잠겨요';
    else if (r.via === 'system' && r.reason === 'no-pjh-lock') lockNotice = 'PJH-LOCK이 꺼져 있어서 Windows 잠금으로 잠갔어요';
    else if (r.via === 'failed') lockNotice = '잠그지 못했어요';
    else lockNotice = '';
    setTimeout(() => { lockNotice = ''; loadLock(); }, 15000);
    loadLock();
  });

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
    loadNet();
    loadStatus();
    loadLock();
  }

  // ---------- 시작 ----------

  tickClock();
  tickFocus();
  setInterval(() => { tickClock(); tickFocus(); }, 1000);
  loadMedia();
  setInterval(loadMedia, 2000);
  loadLock();
  setInterval(loadLock, 60 * 1000);
  setTab(tab);
  api.desk.getPinned().then(showPinned);
  refreshAll();
  setInterval(loadNews, NEWS_REFRESH_MS);
  setInterval(loadWeather, WEATHER_REFRESH_MS);
  loadSystem();
  setInterval(loadSystem, SYS_REFRESH_MS);
  setInterval(loadNet, NET_REFRESH_MS);
  setInterval(loadStatus, STATUS_REFRESH_MS);
  // 자정이 지나면 어제 끝낸 일을 정리한다.
  setInterval(loadTodo, 10 * 60 * 1000);
})();
