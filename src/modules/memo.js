window.PJHPages = window.PJHPages || {};

function escapeHtmlMemo(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMemoList(listEl, memos) {
  if (!memos || memos.length === 0) {
    listEl.innerHTML = '<div class="state-msg">할 일이 없습니다. 위에서 추가해보세요.</div>';
    return;
  }
  listEl.innerHTML = `<ul class="memo-list">${memos
    .map(
      (m) => `
      <li class="memo-item${m.done ? ' done' : ''}" data-id="${escapeHtmlMemo(m.id)}">
        <input type="checkbox" class="memo-check" ${m.done ? 'checked' : ''}>
        <span class="memo-text">${escapeHtmlMemo(m.text)}</span>
        <button class="memo-delete" title="삭제">✕</button>
      </li>`
    )
    .join('')}</ul>`;
}

function attachMemoHandlers(listEl, refresh) {
  listEl.querySelectorAll('.memo-check').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const id = checkbox.closest('.memo-item').dataset.id;
      const memos = await window.api.memo.toggle(id);
      renderMemoList(listEl, memos);
      attachMemoHandlers(listEl, refresh);
    });
  });
  listEl.querySelectorAll('.memo-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.memo-item').dataset.id;
      const memos = await window.api.memo.delete(id);
      renderMemoList(listEl, memos);
      attachMemoHandlers(listEl, refresh);
    });
  });
}

PJHPages.memo = function renderMemo(container) {
  container.innerHTML = `
    <div class="page-title">할 일 메모</div>
    <div class="page-sub">이 컴퓨터에 저장됩니다.</div>
    <div class="memo-input-row">
      <input type="text" id="memo-input" placeholder="할 일을 입력하고 Enter">
      <button id="memo-add-btn">추가</button>
    </div>
    <div id="memo-list-wrap"><div class="state-msg">불러오는 중...</div></div>
  `;

  const input = container.querySelector('#memo-input');
  const addBtn = container.querySelector('#memo-add-btn');
  const listEl = container.querySelector('#memo-list-wrap');

  async function load() {
    const memos = await window.api.memo.list();
    renderMemoList(listEl, memos);
    attachMemoHandlers(listEl, load);
  }

  async function addMemo() {
    const text = input.value.trim();
    if (!text) return;
    const memos = await window.api.memo.add(text);
    input.value = '';
    renderMemoList(listEl, memos);
    attachMemoHandlers(listEl, load);
  }

  addBtn.addEventListener('click', addMemo);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addMemo();
  });

  load();
};
