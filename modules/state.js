const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// 위젯 위치, 항상 위 여부 같은 작은 설정. userData/desk-state.json 에 저장한다.

function filePath() {
  return path.join(app.getPath('userData'), 'desk-state.json');
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(filePath(), 'utf-8')) || {};
  } catch {
    cache = {};
  }
  return cache;
}

function get(key) {
  return load()[key];
}

function set(key, value) {
  load()[key] = value;
  try {
    fs.mkdirSync(path.dirname(filePath()), { recursive: true });
    fs.writeFileSync(filePath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // 설정 저장 실패가 위젯 동작을 막으면 안 된다.
  }
}

module.exports = { get, set };
