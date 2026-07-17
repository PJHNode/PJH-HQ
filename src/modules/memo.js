window.PJHPages = window.PJHPages || {};

const NOTE_COLOR_FALLBACK = '#00ff90';
const NOTE_WIDTH = 180;
const NOTE_HEIGHT = 96;

function escapeHtmlBoard(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

PJHPages.memo = function renderMemoPage(container) {
  container.innerHTML = `
    <div class="page-title">할일 메모</div>
    <div class="page-sub">드래그해서 위치를 옮기고, "연결 모드"에서 메모 두 개를 순서대로 클릭하면 선으로 이어집니다. 선을 클릭하면 삭제됩니다.</div>
    <div class="board-toolbar">
      <button id="board-add-btn">+ 메모 추가</button>
      <button id="board-connect-btn">🔗 연결 모드</button>
    </div>
    <div class="board-canvas" id="board-canvas">
      <svg class="board-svg" id="board-svg"></svg>
    </div>
  `;

  const canvas = container.querySelector('#board-canvas');
  const svg = container.querySelector('#board-svg');
  const addBtn = container.querySelector('#board-add-btn');
  const connectBtn = container.querySelector('#board-connect-btn');

  let board = { notes: [], connections: [] };
  let connectMode = false;
  let connectFromId = null;

  function noteById(id) {
    return board.notes.find((n) => n.id === id);
  }

  function drawLines() {
    svg.innerHTML = board.connections
      .map((c) => {
        const a = noteById(c.fromId);
        const b = noteById(c.toId);
        if (!a || !b) return '';
        const ax = a.x + NOTE_WIDTH / 2;
        const ay = a.y + NOTE_HEIGHT / 2;
        const bx = b.x + NOTE_WIDTH / 2;
        const by = b.y + NOTE_HEIGHT / 2;
        return `<line data-conn="${c.id}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" class="board-line" />`;
      })
      .join('');
    svg.querySelectorAll('.board-line').forEach((line) => {
      line.addEventListener('click', async () => {
        const connId = line.dataset.conn;
        board = await window.api.memo.disconnect(connId);
        renderAll();
      });
    });
  }

  function renderNotes() {
    canvas.querySelectorAll('.board-note').forEach((el) => el.remove());
    board.notes.forEach((note) => {
      const el = document.createElement('div');
      el.className = 'board-note' +
        (note.done ? ' done' : '') +
        (connectMode && connectFromId === note.id ? ' selecting' : '');
      el.dataset.id = note.id;
      el.style.left = note.x + 'px';
      el.style.top = note.y + 'px';
      el.style.borderLeftColor = note.color || NOTE_COLOR_FALLBACK;
      el.innerHTML = `
        <div class="note-toolbar">
          <input type="checkbox" class="note-check" ${note.done ? 'checked' : ''}>
          <button class="note-delete" title="삭제">✕</button>
        </div>
        <div class="note-text" contenteditable="true" spellcheck="false">${escapeHtmlBoard(note.text)}</div>
      `;
      canvas.appendChild(el);
      attachNoteHandlers(el, note);
    });
  }

  function renderAll() {
    renderNotes();
    drawLines();
  }

  function attachNoteHandlers(el, note) {
    const checkbox = el.querySelector('.note-check');
    const deleteBtn = el.querySelector('.note-delete');
    const textEl = el.querySelector('.note-text');

    checkbox.addEventListener('click', (e) => e.stopPropagation());
    checkbox.addEventListener('change', async () => {
      board = await window.api.memo.toggle(note.id);
      renderAll();
    });

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      board = await window.api.memo.delete(note.id);
      if (connectFromId === note.id) connectFromId = null;
      renderAll();
    });

    textEl.addEventListener('mousedown', (e) => e.stopPropagation());
    textEl.addEventListener('blur', async () => {
      board = await window.api.memo.updateText(note.id, textEl.textContent);
    });
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        textEl.blur();
      }
    });

    el.addEventListener('mousedown', (e) => {
      if (e.target === checkbox || e.target === deleteBtn || e.target === textEl) return;

      if (connectMode) {
        e.preventDefault();
        if (!connectFromId) {
          connectFromId = note.id;
        } else if (connectFromId !== note.id) {
          const fromId = connectFromId;
          connectFromId = null;
          window.api.memo.connect(fromId, note.id).then((b) => {
            board = b;
            renderAll();
          });
          return;
        } else {
          connectFromId = null;
        }
        renderAll();
        return;
      }

      e.preventDefault();
      const canvasRect = canvas.getBoundingClientRect();
      const offsetX = e.clientX - canvasRect.left - note.x + canvas.scrollLeft;
      const offsetY = e.clientY - canvasRect.top - note.y + canvas.scrollTop;

      function onMove(moveEvt) {
        const rect = canvas.getBoundingClientRect();
        const maxX = Math.max(0, canvas.clientWidth - NOTE_WIDTH);
        const maxY = Math.max(0, canvas.clientHeight - NOTE_HEIGHT);
        const x = Math.min(maxX, Math.max(0, moveEvt.clientX - rect.left - offsetX + canvas.scrollLeft));
        const y = Math.min(maxY, Math.max(0, moveEvt.clientY - rect.top - offsetY + canvas.scrollTop));
        note.x = x;
        note.y = y;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        drawLines();
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        window.api.memo.updatePosition(note.id, note.x, note.y).then((b) => {
          board = b;
        });
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  addBtn.addEventListener('click', async () => {
    const maxX = Math.max(0, canvas.clientWidth - NOTE_WIDTH - 10);
    const maxY = Math.max(0, canvas.clientHeight - NOTE_HEIGHT - 10);
    const x = Math.round(Math.random() * maxX);
    const y = Math.round(Math.random() * maxY);
    board = await window.api.memo.add('새 메모', x, y);
    renderAll();
    const newest = canvas.querySelector('.board-note:last-child .note-text');
    if (newest) {
      const range = document.createRange();
      range.selectNodeContents(newest);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      newest.focus();
    }
  });

  connectBtn.addEventListener('click', () => {
    connectMode = !connectMode;
    connectFromId = null;
    connectBtn.classList.toggle('active', connectMode);
    canvas.classList.toggle('connect-mode', connectMode);
    renderAll();
  });

  (async () => {
    board = await window.api.memo.list();
    renderAll();
  })();
};
