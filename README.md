# PJH Desk

바탕화면 오른쪽에 떠 있는 위젯이에요. PJH HQ(예전 PJH News)를 위젯으로 바꾼 버전이에요.

- **시계:** 지금 시각과 날짜
- **지금 재생 중:** Spotify·브라우저(유튜브)·미디어 플레이어 등에서 재생 중인 곡과 이전/재생·일시정지/다음 버튼. 재생 중일 때만 보여요. (Windows: 미디어 컨트롤을 읽는 PowerShell 도우미, 페도라: playerctl)
- **집중:** 25분 집중 → 5분 휴식 타이머. 끝나면 알림을 띄우고 오늘 몇 번 했는지 세요. 위젯을 다시 켜도 이어져요.
- **자리 비움:** PJH-LOCK 기록에서 오늘 잠근 횟수·시간, 비밀번호 실패·Windows 잠금 전환·강제 종료를 보여줘요. "지금 잠그기"는 PJH-LOCK으로 잠그고, PJH-LOCK이 꺼져 있거나 예전 버전이면 Windows 기본 잠금으로 잠가요(페도라는 GNOME 잠금).
- **날씨:** 현재 기온, 오늘 최고/최저, 습도. 누르면 앞으로 8시간 예보가 펼쳐져요. 지역 이름을 누르면 다른 지역으로 바꿀 수 있어요.
- **시스템:**
  - 내 PC: CPU, 메모리, 디스크(여유 10% 아래면 노랑, 5% 아래면 빨강), 배터리(없으면 켜진 시간)
  - 네트워크: 와이파이 이름·신호 또는 유선, 내려받기/올리기 속도, 1.1.1.1·8.8.8.8 응답 속도와 3분 그래프, 로컬 IP, 공인 IP(평소엔 가리고 누르면 보여요)
  - 서비스: GitHub, Cloudflare, Discord, Claude, OpenAI, AWS 서울의 공식 상태 페이지를 5분마다 확인해서 문제가 있을 때만 색으로 보여줘요
- **오늘 할 일:** 입력하고 Enter로 추가, 눌러서 완료, ×로 삭제. 끝낸 일은 다음 날 자동으로 정리돼요.
- **헤드라인:** 한국(BBC) / 세계(BBC) / GeekNews / HN(Hacker News) / 보안 탭. 세계·HN·보안은 한국어 번역을 같이 보여줘요.
  - 보안 탭은 미국 CISA가 실제 공격에 쓰이고 있다고 확인한 최신 취약점 20개예요. 랜섬웨어에 쓰인 건 빨간 표시가 붙어요. 기사를 누르면 요약과 링크가 펼쳐지고, 링크는 기본 브라우저로 열려요. 15분마다 새로 불러와요.

## 사용법

- 위쪽 막대를 잡고 끌면 위치를 옮길 수 있어요. 위치는 기억돼요.
- 위쪽 버튼: 항상 위에 두기 · 새로고침 · 숨기기
- 숨겨도 꺼지지 않고 트레이에 남아요. 트레이 아이콘을 누르면 다시 보여요.
- 트레이 메뉴: 보이기/숨기기, 항상 위에 두기, 새로고침, 위치 처음으로, Windows 시작할 때 실행, 종료

## 실행 / 빌드

```bash
npm install
npm start                          # 개발 실행
npm run dist                       # dist/PJH-Desk.exe (설치 없이 실행되는 exe 하나)
npx electron-builder --win nsis       # dist/PJH-Desk-Setup.exe (설치 파일)
```

압축은 5단계로 고정했어요. 최고 단계(9)는 이 PC에서 메모리 부족으로 자주 실패해요.

VS Code 안의 터미널에서 실행할 때 `ELECTRON_RUN_AS_NODE=1`이 설정돼 있으면 Electron이 일반 node처럼 동작해서 켜지지 않아요. 그 변수를 지우고 실행하세요.

화면 확인용: `PJH_DESK_CAPTURE=저장할.png`(필요하면 `PJH_DESK_CAPTURE_TAB=korea|world|hn`)를 주고 실행하면 데이터를 불러온 뒤 화면을 PNG로 저장하고 꺼져요.

## 데이터 출처

| 항목 | 주소 |
|---|---|
| BBC 한국 | https://feeds.bbci.co.uk/korean/rss.xml |
| BBC 세계 | https://feeds.bbci.co.uk/news/world/rss.xml |
| GeekNews | https://news.hada.io/rss/news |
| Hacker News | 공식 API(hacker-news.firebaseio.com), 실패하면 Algolia(hn.algolia.com) |
| 보안 취약점 | CISA KEV (cisa.gov, 6시간마다) |
| 서비스 상태 | 각 서비스 Statuspage API, AWS Health(서울 리전·전역만) |
| 공인 IP | api.ipify.org |
| 응답 속도 | 1.1.1.1·8.8.8.8의 443 포트 TCP 연결 시간(관리자 권한 불필요) |
| 날씨 | Open-Meteo (위치 자동 감지: ipwho.is) |
| 번역 | Google 번역 무료 주소. 제목을 묶어서 한 번에 보내고, 번역한 제목은 기억해 둬요. 429(요청이 너무 많음)를 받으면 30분 동안 번역을 쉬고 원문만 보여줘요. |

## 파일 구성

| 파일 | 역할 |
|---|---|
| `main.js` | 위젯 창, 트레이, 렌더러와 주고받는 기능 |
| `preload.js` | 렌더러에 열어 주는 기능 목록 |
| `modules/news/` | BBC 피드, 번역 |
| `modules/hn/` | Hacker News |
| `modules/geek/` | GeekNews |
| `modules/kev/` | 보안 취약점(CISA KEV) |
| `modules/sys/` | 내 PC 상태(CPU·메모리·디스크·네트워크 속도) |
| `modules/net/` | 응답 속도, IP, 와이파이/유선 |
| `modules/status/` | 서비스 상태 |
| `modules/lock/` | PJH-LOCK 연결(지금 잠그기, 오늘 기록 요약) |
| `modules/media/` | 지금 재생 중(`smtc.ps1` 도우미, playerctl) |
| `modules/weather/` | 날씨, 위치 |
| `modules/todo/` | 오늘 할 일 저장 (`todo.json`) |
| `modules/state.js` | 위젯 위치·항상 위 설정 (`desk-state.json`) |
| `src/` | 위젯 화면 (`index.html`, `desk.css`, `desk.js`) |
| `tools/make-icon.ps1` | 아이콘 만들기 |
