window.PJHPages = window.PJHPages || {};

const WEATHER_LOCATION_KEY = 'pjh-hq:weather:location';

const WMO_CODES = {
  0: ['맑음', '☀️'],
  1: ['대체로 맑음', '🌤️'],
  2: ['구름 조금', '⛅'],
  3: ['흐림', '☁️'],
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

function escapeHtmlLocal(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayLabel() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function renderHourly(hourly, currentTime) {
  if (!hourly || !hourly.time) return '';
  const startIdx = Math.max(0, hourly.time.findIndex((t) => t >= currentTime));
  const times = hourly.time.slice(startIdx, startIdx + 24);
  const temps = hourly.temperature_2m.slice(startIdx, startIdx + 24);
  const codes = hourly.weather_code.slice(startIdx, startIdx + 24);

  const cards = times
    .map((t, i) => {
      const hh = t.split('T')[1].slice(0, 2);
      const [, emoji] = describeCode(codes[i]);
      return `
        <div class="hour-card">
          <div class="hour-time">${hh}시</div>
          <div class="hour-emoji">${emoji}</div>
          <div class="hour-temp">${Math.round(temps[i])}°</div>
        </div>`;
    })
    .join('');
  return `<div class="hourly-row">${cards}</div>`;
}

function renderWeatherCard(cardEl, hourlyEl, location, weather) {
  const { current, hourly } = weather;
  const [desc, emoji] = describeCode(current.weather_code);
  cardEl.innerHTML = `
    <div class="weather-loc">${escapeHtmlLocal(location.name || '현재 위치')}</div>
    <div class="weather-date">${escapeHtmlLocal(todayLabel())}</div>
    <div class="weather-main">
      <span class="weather-emoji">${emoji}</span>
      <span class="weather-temp">${Math.round(current.temperature_2m)}°C</span>
    </div>
    <div class="weather-desc">${escapeHtmlLocal(desc)}</div>
    <div class="weather-sub">습도 ${current.relative_humidity_2m}% · 풍속 ${current.wind_speed_10m}km/h</div>
  `;
  hourlyEl.innerHTML = `<div class="hourly-title">시간대별 예보</div>${renderHourly(hourly, current.time)}`;
}

async function loadWeatherFor(location, cardEl, hourlyEl) {
  cardEl.innerHTML = '<div class="state-msg">날씨 불러오는 중...</div>';
  hourlyEl.innerHTML = '';
  try {
    const weather = await window.api.weather.get(location.latitude, location.longitude);
    renderWeatherCard(cardEl, hourlyEl, location, weather);
  } catch (err) {
    cardEl.innerHTML = `<div class="state-msg error">날씨를 불러오지 못했습니다: ${escapeHtmlLocal(err.message || err)}</div>`;
  }
}

async function loadAutoLocation(cardEl, hourlyEl, locLabelEl) {
  cardEl.innerHTML = '<div class="state-msg">현재 위치 감지 중...</div>';
  try {
    const location = await window.api.weather.detectLocation();
    locLabelEl.textContent = `현재 위치: ${location.name || '알 수 없음'}`;
    await loadWeatherFor(location, cardEl, hourlyEl);
  } catch (err) {
    cardEl.innerHTML = `<div class="state-msg error">위치를 감지하지 못했습니다: ${escapeHtmlLocal(err.message || err)}</div>`;
  }
}

PJHPages.weather = function renderWeather(container) {
  container.innerHTML = `
    <div class="page-title">날씨</div>
    <div class="page-sub" id="weather-loc-label">위치 확인 중...</div>

    <div class="weather-card" id="weather-card">
      <div class="state-msg">불러오는 중...</div>
    </div>
    <div id="weather-hourly"></div>

    <div class="weather-search">
      <input type="text" id="weather-search-input" placeholder="지역 검색 (예: 부산, 도쿄, Paris)">
      <button id="weather-search-btn">검색</button>
      <button id="weather-my-location-btn">내 위치 사용</button>
    </div>
    <div id="weather-search-results"></div>
  `;

  const cardEl = container.querySelector('#weather-card');
  const hourlyEl = container.querySelector('#weather-hourly');
  const locLabelEl = container.querySelector('#weather-loc-label');
  const searchInput = container.querySelector('#weather-search-input');
  const searchBtn = container.querySelector('#weather-search-btn');
  const myLocBtn = container.querySelector('#weather-my-location-btn');
  const resultsEl = container.querySelector('#weather-search-results');

  const saved = getSavedLocation();
  if (saved) {
    locLabelEl.textContent = `저장된 위치: ${saved.name}`;
    loadWeatherFor(saved, cardEl, hourlyEl);
  } else {
    loadAutoLocation(cardEl, hourlyEl, locLabelEl);
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
        .map(
          (r, i) => `<li data-index="${i}">${escapeHtmlLocal(r.name)}</li>`
        )
        .join('')}</ul>`;
      resultsEl.querySelectorAll('li').forEach((li, i) => {
        li.addEventListener('click', () => {
          const loc = results[i];
          saveLocation(loc);
          locLabelEl.textContent = `저장된 위치: ${loc.name}`;
          resultsEl.innerHTML = '';
          searchInput.value = '';
          loadWeatherFor(loc, cardEl, hourlyEl);
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
    loadAutoLocation(cardEl, hourlyEl, locLabelEl);
  });
};
