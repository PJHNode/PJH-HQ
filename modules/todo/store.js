const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// 오늘 할 일 목록. userData/todo.json 에 저장한다.
// 완료한 일은 완료한 날까지만 보이고, 다음 날이 되면 목록에서 정리된다.

function filePath() {
  return path.join(app.getPath('userData'), 'todo.json');
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function read() {
  try {
    const data = JSON.parse(fs.readFileSync(filePath(), 'utf-8'));
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function write(items) {
  const file = filePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ items }, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

// 어제 이전에 끝낸 일은 정리한다.
function prune(items) {
  const today = todayKey();
  return items.filter((it) => !it.done || it.doneOn === today);
}

function list() {
  const items = read();
  const kept = prune(items);
  if (kept.length !== items.length) write(kept);
  return kept;
}

function add(text) {
  const value = String(text || '').trim().slice(0, 200);
  const items = list();
  if (!value) return items;
  items.push({ id: genId(), text: value, done: false, createdAt: new Date().toISOString(), doneOn: null });
  write(items);
  return items;
}

function toggle(id) {
  const items = list();
  const it = items.find((x) => x.id === id);
  if (it) {
    it.done = !it.done;
    it.doneOn = it.done ? todayKey() : null;
    write(items);
  }
  return items;
}

function remove(id) {
  const items = list().filter((x) => x.id !== id);
  write(items);
  return items;
}

module.exports = { list, add, toggle, remove };
