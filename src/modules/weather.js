window.PJHPages = window.PJHPages || {};

const WEATHER_LOCATION_KEY = 'pjh-hq:weather:location';

const WMO_CODES = {
  0: ['맑음', '☀️'],
  1: ['대체로 맑음', '🌤️'],
  2: ['구름 조금', '⛅'],
  3: ['구름 많음/흐림', '☁️'],
  45: ['안개', '🌫️'],
  48: ['짙은 안개', '🌫️'],
  51: ['이슬비 약함', '🌦️'],
  53: ['이슬비', '🌦️'],
  55: ['이슬비 강함', '🌦️'],
  61: ['비 약함', '🌧️'],
  63: ['비', '🌧️'],
  65: ['비 강함', '🌧️'],
  71: ['눈 약함', '🌨️'],
  73: ['눈', '🌨️'],
  75: ['눈 강함', '🌨️'],
  80: ['소나기 약함', '🌦️'],
  81: ['소나기', '🌦️'],
  82: ['소나기 강함', '⛈️'],
  95: ['뇌우', '⛈️'],
  96: ['뇌우(우박 동반)', '⛈️'],
  99: ['뇌우(우박 동반)', '⛈️'],
};

function describeCode(code) {
  return WMO_CODES[code] || ['알 수 없음', '❓'];
}

function escapeHtmlLocal(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function getSavedLocation() {
  try {
    const raw = localStorage.getItem(WEATHER_LOCATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocation(loc) {
  localStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(loc));
}

function clearSavedLocation() {
  localStorage.removeItem(WEATHER_LOCATION_KEY);
}

function renderWeatherCard(cardEl, location, weather, dateStr) {
  const { current, hourly } = weather;
  const isToday = dateStr === todayStr();
  let temp;
  let code;
  let tag;

  if (isToday) {
    temp = current.temperature_2m;
    code = current.weather_code;
    tag = '현재';
  } else {
    let idx = hourly.time.indexOf(`${dateStr}T12:00`);
    if (idx === -1) idx = hourly.time.findIndex((t) => t.startsWith(dateStr));
    temp = idx === -1 ? null : hourly.temperature_2m[idx];
    code = idx === -1 ? null : hourly.weather_code[idx];
    tag = '정오 기준';
  }

  const [desc, emoji] = describeCode(code);
  cardEl.innerHTML = `
    <div class="weather-loc">${escapeHtmlLocal(location.name || '현재 위치')}</div>
    <div class="weather-date">${escapeHtmlLocal(formatDateLabel(dateStr))} <span class="weather-date-tag">${tag}</span></div>
    <div class="weather-main">
      <span class="weather-emoji">${emoji}</span>
      <span class="weather-temp">${temp == null ? '-' : Math.round(temp) + '°C'}</span>
    </div>
    <div class="weather-desc">${escapeHtmlLocal(desc)}</div>
    ${isToday ? `<div class="weather-sub">습도 ${current.relative_humidity_2m}% · 풍속 ${current.wind_speed_10m}km/h</div>` : ''}
  `;
}

function renderHourDetail(detailEl, hourly, idx) {
  const hh = hourly.time[idx].split('T')[1].slice(0, 2);
  const [desc] = describeCode(hourly.weather_code[idx]);
  const precip = hourly.precipitation_probability ? hourly.precipitation_probability[idx] : null;
  const cloud = hourly.cloud_cover ? hourly.cloud_cover[idx] : null;
  const humidity = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[idx] : null;
  const wind = hourly.wind_speed_10m ? hourly.wind_speed_10m[idx] : null;

  detailEl.innerHTML = `
    <div class="hour-detail-card">
      <div class="hour-detail-title">${hh}시 상세</div>
      <div class="hour-detail-desc">${escapeHtmlLocal(desc)} · ${Math.round(hourly.temperature_2m[idx])}°C</div>
      <div class="hour-detail-grid">
        ${precip != null ? `<div>강수 확률 <b>${precip}%</b></div>` : ''}
        ${cloud != null ? `<div>구름량 <b>${cloud}%</b></div>` : ''}
        ${humidity != null ? `<div>습도 <b>${humidity}%</b></div>` : ''}
        ${wind != null ? `<div>풍속 <b>${wind}km/h</b></div>` : ''}
      </div>
    </div>
  `;
}

function renderHourlyRow(hourlyEl, detailEl, hourly, dateStr) {
  const indices = [];
  hourly.time.forEach((t, i) => {
    if (t.startsWith(dateStr)) indices.push(i);
  });

  if (indices.length === 0) {
    hourlyEl.innerHTML = '<div class="state-msg">해당 날짜의 시간대별 예보가 없습니다.</div>';
    detailEl.innerHTML = '';
    return;
  }

  const cards = indices
    .map((i) => {
      const hh = hourly.time[i].split('T')[1].slice(0, 2);
      const [, emoji] = describeCode(hourly.weather_code[i]);
      return `
        <div class="hour-card" data-idx="${i}">
          <div class="hour-time">${hh}시</div>
          <div class="hour-emoji">${emoji}</div>
          <div class="hour-temp">${Math.round(hourly.temperature_2m[i])}°</div>
        </div>`;
    })
    .join('');
  hourlyEl.innerHTML = `<div class="hourly-title">시간대별 예보 (클릭하면 상세 정보)</div><div class="hourly-row">${cards}</div>`;

  hourlyEl.querySelectorAll('.hour-card').forEach((card) => {
    card.addEventListener('click', () => {
      hourlyEl.querySelectorAll('.hour-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      renderHourDetail(detailEl, hourly, Number(card.dataset.idx));
    });
  });

  detailEl.innerHTML = '';
}

PJHPages.weather = function renderWeather(container) {
  container.innerHTML = `
    <div class="page-title">날씨</div>
    <div class="page-sub" id="weather-loc-label">위치 확인 중...</div>

    <div class="weather-date-row">
      <label for="weather-date-input" class="weather-date-label">날짜 선택</label>
      <input type="date" id="weather-date-input">
    </div>

    <div class="weather-card" id="weather-card">
      <div class="state-msg">불러오는 중...</div>
    </div>
    <div id="weather-hourly"></div>
    <div id="weather-hour-detail"></div>

    <div class="weather-search">
      <input type="text" id="weather-search-input" placeholder="지역 검색 (예: 부산, 도쿄, Paris)">
      <button id="weather-search-btn">검색</button>
      <button id="weather-my-location-btn">내 위치 사용</button>
    </div>
    <div id="weather-search-results"></div>
  `;

  const cardEl = container.querySelector('#weather-card');
  const hourlyEl = container.querySelector('#weather-hourly');
  const detailEl = container.querySelector('#weather-hour-detail');
  const dateInput = container.querySelector('#weather-date-input');
  const locLabelEl = container.querySelector('#weather-loc-label');
  const searchInput = container.querySelector('#weather-search-input');
  const searchBtn = container.querySelector('#weather-search-btn');
  const myLocBtn = container.querySelector('#weather-my-location-btn');
  const resultsEl = container.querySelector('#weather-search-results');

  let currentWeather = null;
  let currentLocation = null;

  function renderForSelectedDate() {
    if (!currentWeather || !currentLocation) return;
    const dateStr = dateInput.value || todayStr();
    renderWeatherCard(cardEl, currentLocation, currentWeather, dateStr);
    renderHourlyRow(hourlyEl, detailEl, currentWeather.hourly, dateStr);
  }

  async function loadWeatherFor(location) {
    currentLocation = location;
    cardEl.innerHTML = '<div class="state-msg">날씨 불러오는 중...</div>';
    hourlyEl.innerHTML = '';
    detailEl.innerHTML = '';
    try {
      const weather = await window.api.weather.get(location.latitude, location.longitude);
      currentWeather = weather;
      const times = weather.hourly.time;
      dateInput.min = times[0].split('T')[0];
      dateInput.max = times[times.length - 1].split('T')[0];
      if (!dateInput.value) dateInput.value = todayStr();
      renderForSelectedDate();
    } catch (err) {
      cardEl.innerHTML = `<div class="state-msg error">날씨를 불러오지 못했습니다: ${escapeHtmlLocal(err.message || err)}</div>`;
    }
  }

  async function loadAutoLocation() {
    cardEl.innerHTML = '<div class="state-msg">현재 위치 감지 중...</div>';
    try {
      const location = await window.api.weather.detectLocation();
      locLabelEl.textContent = `현재 위치: ${location.name || '알 수 없음'}`;
      await loadWeatherFor(location);
    } catch (err) {
      cardEl.innerHTML = `<div class="state-msg error">위치를 감지하지 못했습니다: ${escapeHtmlLocal(err.message || err)}</div>`;
    }
  }

  dateInput.addEventListener('change', renderForSelectedDate);

  const saved = getSavedLocation();
  if (saved) {
    locLabelEl.textContent = `저장된 위치: ${saved.name}`;
    loadWeatherFor(saved);
  } else {
    loadAutoLocation();
  }

  async function runSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    resultsEl.innerHTML = '<div class="state-msg">검색 중...</div>';
    try {
      const results = await window.api.weather.search(query);
      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="state-msg">검색 결과가 없습니다.</div>';
        return;
      }
      resultsEl.innerHTML = `<ul class="weather-result-list">${results
        .map((r, i) => `<li data-index="${i}">${escapeHtmlLocal(r.name)}</li>`)
        .join('')}</ul>`;
      resultsEl.querySelectorAll('li').forEach((li, i) => {
        li.addEventListener('click', () => {
          const loc = results[i];
          saveLocation(loc);
          locLabelEl.textContent = `저장된 위치: ${loc.name}`;
          resultsEl.innerHTML = '';
          searchInput.value = '';
          dateInput.value = '';
          loadWeatherFor(loc);
        });
      });
    } catch (err) {
      resultsEl.innerHTML = `<div class="state-msg error">검색 실패: ${escapeHtmlLocal(err.message || err)}</div>`;
    }
  }

  searchBtn.addEventListener('click', runSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });

  myLocBtn.addEventListener('click', () => {
    clearSavedLocation();
    resultsEl.innerHTML = '';
    dateInput.value = '';
    loadAutoLocation();
  });
};
