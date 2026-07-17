async function translateToKorean(text) {
  if (!text) return '';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`번역 실패 (${res.status})`);
  }
  const data = await res.json();
  return data[0].map((seg) => seg[0]).join('');
}

module.exports = { translateToKorean };
