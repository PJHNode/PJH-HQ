const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function filePath() {
  return path.join(app.getPath('userData'), 'memos.json');
}

function readAll() {
  try {
    const raw = fs.readFileSync(filePath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(memos) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(memos, null, 2), 'utf-8');
}

function listMemos() {
  return readAll();
}

function addMemo(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return readAll();
  const memos = readAll();
  memos.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: trimmed,
    done: false,
    createdAt: new Date().toISOString(),
  });
  writeAll(memos);
  return memos;
}

function toggleMemo(id) {
  const memos = readAll();
  const target = memos.find((m) => m.id === id);
  if (target) target.done = !target.done;
  writeAll(memos);
  return memos;
}

function deleteMemo(id) {
  const memos = readAll().filter((m) => m.id !== id);
  writeAll(memos);
  return memos;
}

module.exports = { listMemos, addMemo, toggleMemo, deleteMemo };
