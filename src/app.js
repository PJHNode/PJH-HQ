// 페이지 모듈 레지스트리 - 각 모듈(src/modules/*.js)이 여기에 render 함수를 등록한다.
// 새 기능을 추가하려면: src/modules/새기능.js 작성 → PJHPages['새기능'] = renderFn
// → index.html에 <div class="nav-item" data-page="새기능">, <script> 태그 추가.
window.PJHPages = window.PJHPages || {};

PJHPages.home = function renderHome(container) {
  container.innerHTML = `
    <div class="page-title">홈</div>
    <div class="page-sub">왼쪽 메뉴에서 기능을 선택하세요.</div>
    <p class="home-hint">현재 사용 가능: 오늘의 뉴스 · 날씨 · 할일 메모</p>
  `;
};

(function initNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const content = document.getElementById('content');

  function activate(page) {
    navItems.forEach((el) => el.classList.toggle('active', el.dataset.page === page));
    const renderFn = PJHPages[page];
    if (typeof renderFn === 'function') {
      renderFn(content);
    } else {
      content.innerHTML = '<div class="state-msg">준비 중인 기능입니다.</div>';
    }
  }

  navItems.forEach((el) => {
    el.addEventListener('click', () => activate(el.dataset.page));
  });

  activate('home');
})();
