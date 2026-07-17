async function detectLocation() {
  const res = await fetch('https://ipwho.is/');
  if (!res.ok) {
    throw new Error(`위치 감지 실패 (${res.status})`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || '위치 감지 실패');
  }
  return {
    name: [data.city, data.region].filter(Boolean).join(' '),
    latitude: data.latitude,
    longitude: data.longitude,
  };
}

async function searchLocation(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=ko`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`지역 검색 실패 (${res.status})`);
  }
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

async function getWeather(latitude, longitude) {
  const hourlyVars = 'temperature_2m,weather_code,precipitation_probability,cloud_cover,relative_humidity_2m,wind_speed_10m';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=${hourlyVars}&past_days=7&forecast_days=16&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`날씨 조회 실패 (${res.status})`);
  }
  const data = await res.json();
  return { current: data.current, hourly: data.hourly, timezone: data.timezone };
}

module.exports = { detectLocation, searchLocation, getWeather };
