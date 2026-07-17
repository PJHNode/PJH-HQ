const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const NOTE_COLORS = ['#00ff90', '#00c8ff', '#ffb100', '#ff5c8a', '#b388ff'];

function filePath() {
  return path.join(app.getPath('userData'), 'board.json');
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readBoard() {
  try {
    const raw = fs.readFileSync(filePath(), 'utf-8');
    const data = JSON.parse(raw);
    return { notes: data.notes || [], connections: data.connections || [] };
  } catch {
    return { notes: [], connections: [] };
  }
}

function writeBoard(board) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(board, null, 2), 'utf-8');
}

function listBoard() {
  return readBoard();
}

function addNote(text, x, y) {
  const board = readBoard();
  board.notes.push({
    id: genId(),
    text: String(text || '').trim() || '새 메모',
    done: false,
    x: typeof x === 'number' ? x : 20,
    y: typeof y === 'number' ? y : 20,
    color: NOTE_COLORS[board.notes.length % NOTE_COLORS.length],
    createdAt: new Date().toISOString(),
  });
  writeBoard(board);
  return board;
}

function updateNoteText(id, text) {
  const board = readBoard();
  const note = board.notes.find((n) => n.id === id);
  if (note) note.text = String(text || '').trim() || '(빈 메모)';
  writeBoard(board);
  return board;
}

function updateNotePosition(id, x, y) {
  const board = readBoard();
  const note = board.notes.find((n) => n.id === id);
  if (note) {
    note.x = x;
    note.y = y;
  }
  writeBoard(board);
  return board;
}

function toggleNote(id) {
  const board = readBoard();
  const note = board.notes.find((n) => n.id === id);
  if (note) note.done = !note.done;
  writeBoard(board);
  return board;
}

function deleteNote(id) {
  const board = readBoard();
  board.notes = board.notes.filter((n) => n.id !== id);
  board.connections = board.connections.filter((c) => c.fromId !== id && c.toId !== id);
  writeBoard(board);
  return board;
}

function addConnection(fromId, toId) {
  const board = readBoard();
  if (fromId === toId) return board;
  const exists = board.connections.some(
    (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)
  );
  if (!exists) {
    board.connections.push({ id: genId(), fromId, toId });
    writeBoard(board);
  }
  return board;
}

function deleteConnection(id) {
  const board = readBoard();
  board.connections = board.connections.filter((c) => c.id !== id);
  writeBoard(board);
  return board;
}

module.exports = {
  listBoard,
  addNote,
  updateNoteText,
  updateNotePosition,
  toggleNote,
  deleteNote,
  addConnection,
  deleteConnection,
};
