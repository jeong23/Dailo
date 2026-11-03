# Dailo Frontend (frontend/Dailo)

> 공통 규칙은 루트 `CLAUDE.md` 참고. 세액공제 계산기 상세 스펙은 `docs/tax-calc.md`.

## 개요
- React 19 + TypeScript + Tailwind CSS + Recharts
- 포트: 3000 (개발 시), 배포 시 Spring Boot(8888)에서 정적 서빙
- API 백엔드: /api (상대경로 — Spring Boot 정적 서빙 기준)

## 실행
- npm start (개발) / 변경 확인은 보통 `ddeploy` + 백엔드 재시작 방식 사용 (루트 CLAUDE.md 참고)

## 폴더 구조
```
src/
├── api/        # axios 인스턴스 (baseURL: /api, proxy → 8888)
├── components/ # Layout.tsx (네비 + 다크모드)
├── pages/      # 페이지 컴포넌트
├── types/      # index.ts (공통 타입)
└── utils/      # format.ts (숫자 포맷, 정산월 계산)
```

## 페이지 구성
| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| / | DashboardHome (App.tsx) | 대시보드 메인 |
| /login | LoginPage | JWT 로그인 |
| /signup | SignupPage | 회원가입 (가입 후 바로 로그인) |
| /expenses | ExpensesPage | 지출/수입 통합 관리 (탭) |
| /fixed-costs | FixedCostPage | 고정비 관리 |
| /savings | SavingsPage | 적금·주택청약 (쌓이는 돈 — 고정비와 분리) |
| /report | ReportPage | 월별 정산 리포트 |
| /cash | EmergencyPage | 현금 자산 (달별 추이). 옛 /emergency는 리다이렉트 — 파일명만 옛 이름 |
| /settings | BudgetSettingsPage | 예산 설정 (사이드바 가계부 그룹) |
| /todo | TodoPage | 일일 플래너 (SIMOL 다이어리 구조) |
| /planner-board | PlannerBoardPage | 월간 플래너 보드 (달력 뷰) |
| /running | RunningPage | 운동 기록 (NRC 스타일) |
| /habits | HabitPage | 습관 트래커 |
| /assets | AllocationPage | 자산 현황 (현금·투자·부동산·적금 합계 + 목표 배분). 옛 /allocation은 리다이렉트 |
| /invest | InvestDashboardPage | 투자 현황 |
| /invest/diary | InvestDiaryPage | 투자일기 |
| /accounts | MyAccountsPage | 내 계좌 — 현금·적금/청약·투자 계좌 등록·관리 한곳 (?tab=cash/savings/invest) |
| /invest/settings | → /accounts?tab=invest | 리다이렉트 (InvestSettingsPage는 내 계좌 투자 탭에 embedded) |

## 핵심 유틸 (src/utils/format.ts)
- formatNumber(value): 숫자 → "1,000,000" 콤마 포맷
- parseNumber(value): "1,000,000" → 숫자
- getCurrentSettleMonth(): 오늘 기준 정산월 반환 (25일 이후면 다음 달)
- getSettleMonthForDate(dateStr): 특정 날짜 기준 정산월 (지출/수입 저장 시 사용)
- getMonthOptions(count=6): 현재 정산월부터 N개월 옵션 배열

## 주요 타입 (src/types/index.ts)
- DailyExpense: categoryName(string) 필드 있음 — category.name 아님
- DashboardSummary: extraIncomeTotal 포함
- BudgetType: '생활비' | '비상금' | '투자'

## 상태 관리 규칙
- memberId: 프론트 전역에서 getStoredMemberId() 사용 — 하드코딩 1 절대 금지
- monthlyBudgetId: 하드코딩 금지 → /monthly-budgets/member/{memberId}/month/{월} API로 조회
- categoryId 초기값: 하드코딩 금지 → categories[0].id 사용
- selectedMonth 초기값: 하드코딩 금지 → getCurrentSettleMonth() 사용
- monthOptions: getMonthOptions() 금지 → /monthly-budgets/member/{memberId} API로 저장된 월만 조회
  (BudgetSettingsPage만 예외: 신규 달 입력을 위해 현재 정산월 없으면 목록 앞에 추가)
- 복수 API 동시 호출 시 Promise.allSettled 사용 (Promise.all 금지 — 하나 실패 시 전체 실패)

## 다크모드 / 색 테마 (화면 설정 /preferences — DisplaySettingsPage)
- Tailwind class 전략 사용, 적용 로직은 `utils/theme.ts` 단일 소스 — index.tsx에서 렌더 전 initTheme() (깜빡임 방지)
- 모드: localStorage 'themeMode' = light | dark | system (기본 dark). system이면 prefers-color-scheme 변경 추적
  → 옛 'darkMode' 키는 themeMode 없을 때만 읽고, 저장 시 같이 갱신(호환용)
- 색 테마: localStorage 'colorTheme' = {id: 프리셋 | 'custom', accent?, sidebar?}
  → tailwind `primary-*`와 `sidebar` 색은 CSS 변수(`--primary-50..900`, `--sidebar-bg`, "r g b" 형식) — 기본값은 index.css(tailwind blue)
  → 'blue' 프리셋은 tailwind blue 원본 그대로, 나머지는 강조색 하나에서 50~900 스케일 생성. 너무 밝은 강조색은 흰 글자가 읽히게 어둡게 보정
  → 새 hex 하드코딩 대신 primary-* 클래스를 써야 테마를 따라감. 사이드바 배경은 `bg-sidebar`
- isDark가 필요하면 useTheme() 사용 (Layout 로고 밝기 등) — documentElement.classList를 직접 토글 금지
- 스크롤바: `index.css`에서 전역 처리 — `html.dark`에 `color-scheme: dark` + CSS 변수(--scrollbar-thumb)로 썸 색 전환
  → color-scheme 없으면 다크모드에서도 흰 스크롤 트랙·흰 date picker가 나옴
  → 둥근 시트 안 스크롤 영역은 `themed-scrollbar`(위아래 여백), 가로 칩 목록은 `no-scrollbar`

## 비상금 누적액 규칙
- emergencyCumulative는 EmergencyPage(/emergency)에서 sequential 계산이 단일 소스
- BudgetSettingsPage에서 읽기 전용 표시만 함 (수동 입력 금지)
- 저장 body에 emergencyCumulative 포함 금지

## 대시보드 차트 규칙
- 파이차트: Pie에 key={pieChartData.map(d=>d.name).join(',')} 필수 — 없으면 데이터 로드 후 애니메이션 미동작
- 바 차트 툴팁: DailyBarTooltip 커스텀 컴포넌트 사용 — 해당 날짜 expenses 필터링해 top3 표시

## 빌드 및 배포
- 배포: `npm run deploy` — 빌드 + Spring Boot static 폴더 복사 한번에 처리
  - Spring Boot가 static 폴더를 웹으로 서빙 (프론트/백 서버를 8888 하나로 통합)
- axios baseURL: `/api` (상대경로) — `http://localhost:8888/api`로 바꾸면 외부 배포 시 broken

## TodoPage 규칙
- 자동저장 타이머: planTimer / todoTimer(per-id Record) / timeboxTimer 별도 관리 — 하나로 합치면 충돌
- updateTodoContent: isDone을 state에서 읽지 말고 파라미터로 직접 전달 (클로저 stale 방지)
- useSearchParams로 ?date= 파라미터 읽기 — useState 초기값 + useEffect 감지 둘 다 필요
  (이미 마운트된 상태에서 날짜 변경 시 useEffect 없으면 반영 안 됨)
- 신호등 색상: 내용 없음 → 투명 / 미완료(내용 있음) → 빨강 / 완료 → 초록
  - itemRowStyle(content, isDone): 행 배경색
  - itemTextStyle(content, isDone): 텍스트 색 + 완료 시 line-through
  - slotStyle(value, done): TimeBox 셀 배경+텍스트
- TimeBox 셀 클릭 → done 토글 / 텍스트 입력 클릭 → e.stopPropagation()으로 분리
- Brain Dump ↔ Big3 드래그앤드롭: 마우스는 HTML5 DnD API(draggable), 터치는 ⠿ 핸들의 Pointer Events(touchHandleProps)
  - HTML5 DnD는 터치에서 동작 안 함 → 핸들 pointerdown(pointerType≠mouse)에서 시작, elementFromPoint + `data-drop-zone`/`data-big3-idx`로 놓을 곳 판정
  - 핸들은 `touch-none`(드래그 중 스크롤 방지) + 44px 높이, 손가락 따라오는 미리보기(ghost), 화면 위·아래 60px에서 스크롤 컨테이너 자동 스크롤
  - setPointerCapture는 try/catch — 실패해도 핸들에서 move/up 받음
  - Big3 꽉 찬 상태에서 Brain Dump 항목을 올리면 빨간 배경 + "3개가 꽉 찼어요" (big3Blocked)
  - 삭제 ✕는 `[@media(hover:hover)]:opacity-0` — hover 없는 터치 기기에선 항상 보임 (group-hover만 쓰면 폰에서 삭제 불가)
  - PUT /todo-items/{id} 에 type 필드 포함하여 타입 변경
  - Big3 → Brain Dump: 조건 없음 / Brain Dump → Big3: Big3 3개 미만일 때만
  - 드래그 중 대상 영역 파란색 하이라이트 (dragOver state)
- Brain Dump: 항목 추가 시 autoFocus (focusId state로 관리), "+" 버튼 항상 리스트 하단에 위치
- 체크박스 커스텀 스타일:
  - Brain Dump: 라운드 사각형(rounded-md), 미완료=빨강, 완료=초록+체크 아이콘
  - Big3: 원형(rounded-full) 번호 뱃지, 내용 없음=회색 outline, 미완료=빨강 outline, 완료=초록 filled
- TimeBox Block (블록 병합 기능):
  - TIME_BOX_SLOT(텍스트 입력)과 TIME_BOX_BLOCK(블록)은 동일 셀에 공존
  - 블록 생성: 클릭으로 시작점 선택(파란 하이라이트) → Shift+클릭으로 끝점 선택 → 블록 생성
  - 블록 삭제: 블록 내 ✕ 버튼
  - 시간 범위 05~다음날 04시(2026-10-29): 자정 이후는 같은 플랜 날짜에 hour=24..28로 저장, 라벨은 hourLabel()로 24 / 01~04 — 0~4로 저장하면 정렬·slotToIndex가 깨짐
  - 블록 렌더링: time.jpeg 참고 3열(시간 | 30mins | 30mins)을 **CSS grid**로 — table 아님. 30분 단위 블록은 blockPieces()로 앞 반 칸 / 꽉 찬 시간들 / 뒤 반 칸 조각으로 나눠 그림, 입력은 가장 큰 조각에만
  - 블록 색상: 내용 없음=회색, 내용+미완료=빨강 border+배경, 완료=초록 border+배경
  - 선택: 데스크탑 Shift+클릭 → 시작, 다른 칸 클릭 → 생성(호버 미리보기, Esc 취소) / '＋ 블록 만들기' 모드(폰·데스크탑) = 드래그 또는 시작·끝 탭
    → 모드 중 칸은 touch-none(스크롤은 시간 열), move/up은 window에서 받고 data-slot-idx + elementFromPoint로 판정, 기존 블록과 겹치면 생성 거부
    → 탭으로 생성 직후 따라오는 click이 완료 토글로 처리되지 않게 suppressClickUntil
  - slotToIndex(hour, slot) = (hour - 5) * 2 + slot / indexToSlot은 역변환
- 미래 시각화 = `components/VisionBoard.tsx` 보드 (2026-10): 회원별 보드 하나(날짜 무관), 사진 최대 20장 자유 배치
  → 업로드는 shrinkImage(긴 변 1920px JPEG, GIF·1MB 미만은 원본) → upload-image → POST /vision-board, 여러 장 선택 가능
  → 위치·크기는 보드 대비 %(보드 aspect 4:3 고정) — 폭이 달라도 같은 배치. 크기 조절은 오른쪽 아래 ●, 사진 비율 유지
  → 마우스는 바로 드래그, 터치는 탭해서 선택된 사진만 드래그(touch-none) — 선택 안 된 사진 위 스와이프는 페이지 스크롤
  → 저장은 drag.current.last 값으로 — itemsRef는 렌더 후 갱신이라 pointerup 시점엔 한 박자 늦은 값일 수 있음
  → 옛 DailyPlan.futureVisionUrl(날짜별 1장)은 남아 있음: 보드가 비었을 때 '이 날 올렸던 사진 가져오기'로만 사용
  → 이미지 URL은 R2 절대주소 또는 `/uploads/...` 상대주소 둘 다 올 수 있음
- 플래너 레이아웃 스크롤: root div `h-full flex flex-col` + 콘텐츠 wrapper `flex-1 min-h-0 overflow-auto`
  - flex 자식에 overflow-auto만으론 스크롤 안 됨 — `min-h-0` 필수 (min-height: auto 기본값 때문)

## PlannerBoardPage 규칙
- {year, month} 단일 state 객체로 관리 — 분리 시 useEffect가 두 번 발화해 이중 API 호출
- 달력 셀 border: `[&:nth-child(7n)]:border-r-0` 사용 — `last:border-r-0`은 마지막 셀 하나에만 적용됨
- 셀 클릭 → navigate(`/todo?date=${ds}`) 로 TodoPage 연동
- 모바일 가로 스크롤: overflow-x-auto wrapper + min-w-[480px] 로 처리
- 하단 월간 메모(localStorage 'plannerGoals-YYYY-MM')는 자동 리스트 — `utils/listTextarea.ts` handleListKeyDown/startListOnFocus
  → Enter로 • / 1. / ☐ 기호 이어쓰기, 빈 항목 Enter는 목록 종료, 줄 맨 앞 -·*·[] + Space 변환
  → 한글 IME 조합 중(isComposing / keyCode 229) Enter는 무시해야 함 — 안 그러면 마지막 글자 중복
  → 값 변경은 execCommand('insertText')로 — onChange 발화 + Ctrl+Z 유지. 기호만 남은 메모는 빈 값으로 저장(isBlankList)

## RunningPage 규칙
- 카카오맵 SDK: `public/index.html` `<head>`에 스크립트 태그로 직접 로드 — useKakaoLoader 사용 시 불안정
  `<script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=%REACT_APP_KAKAO_MAP_KEY%">`
- API 키: `.env` 파일의 `REACT_APP_KAKAO_MAP_KEY` — 카카오 개발자 콘솔 플랫폼 키 > JavaScript 키
- 도메인 등록: 카카오 개발자 콘솔 > 앱 설정 > 앱 > 플랫폼 키 > JavaScript 키 선택 후 해당 키에서 도메인 등록
  (일반 플랫폼 > Web 섹션이 아님 — 키별로 도메인 등록해야 함)
- 지도 초기화: vanilla `window.kakao.maps.Map()` 직접 사용 — react-kakao-maps-sdk 컴포넌트 사용 시 전역 스크립트와 충돌
- 지도는 위치 표시 전용 (경로 그리기 기능 제거됨)
- 경로 표시: pathRef.current로 관리 — 지도 init 콜백 내에서 drawPath(pathRef.current) 직접 호출 (stale closure 방지)
- 페이스 계산: 백엔드 RecordResponse.calcPace() — durationSeconds / distanceKm → "7'05''" 형식 반환
- 시간 입력: "MM:SS" 단일 필드, 숫자만 추출 후 자동 콜론 삽입
  ```ts
  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
  const formatted = digits.length > 2 ? `${digits.slice(0,2)}:${digits.slice(2)}` : digits;
  ```
- 평균 페이스: 거리+시간 입력 시 실시간 자동 계산 (calcLivePace)
- 탭: 주(weekStart 기준 7일), 년(selectedYear 기준 1~12월) — fetchWeekData / fetchYearData 별도
- 주 네비게이션 레이블: "N월 M주차" 형식 (getWeekOfMonth 헬퍼)
- 쉬었어요 기록 시 path 초기화: `setRecForm(p => ({ ...p, ran: false, path: [] }))`

## WeightTab 규칙 (RunningPage '웨이트' 탭 — 2026-10 번핏 스타일 개편)
- 레이아웃: lg 2열(달력/통계·루틴 | 선택한 날 운동), 모바일 순서는 달력 → 오늘 운동 → 통계·루틴 (order-last + lg:col/row-start)
- 부위 분류: `utils/bodyPart.ts` getBodyPart(종목명) — DB에 부위 컬럼 없음. EXERCISE_LIBRARY 정확 일치 → 키워드 정규식 순서(복근→하체→팔→어깨→가슴→등)
  → 순서 바꾸면 '레그 레이즈'가 하체, '레그 컬'이 팔로 잘못 분류됨
- {year, month} 단일 view state + 지난 달 로그도 같이 조회 (이전 기록·전월 대비용), 월 이동 시 selectedDate는 그 달 안으로 맞춤
- 세트 표: 세트|이전|kg|회|완료 — '이전' 클릭 시 지난 세션 값 복사, 빈 칸 상태로 ✓ 누르면 이전 값 채우고 완료 + 휴식 타이머 시작
- kg/회 입력은 NumCell(내부 문자열 state) 사용 — 숫자 state에 바로 parseFloat하면 "62." 입력 불가
- 휴식 시간 localStorage 'restSeconds' (기본 90초), 저장 여부는 snapshotOf()로 서버 값과 비교, 미저장 상태에서 날짜/월 이동 시 confirm
- 종목 이미지: `utils/exerciseInfo.ts` — 1순위 Everkinetic 라인 드로잉 SVG(CC BY-SA 4.0, `art`: id_num), 없는 종목만 free-exercise-db 사진(`photo`)
  → 둘 다 jsDelivr **커밋 고정 URL** (main/master로 바꾸면 원본 변경 시 깨짐)
  → CC BY-SA라 저작자 표기 필수 — ExerciseMotion 하단 캡션(ART_CREDIT) 삭제 금지
  → SVG는 흰 배경+검은 선: 라이트 `mix-blend-multiply`, 다크 `invert + mix-blend-screen`(ART_BLEND) + 부모 `isolate`
    부모 배경은 **불투명색만** — 반투명(`/60` 등)이면 SVG 검은 배경이 비쳐 어두운 사각형이 생김
  → relaxation(시작)/tension(수축) 크로스페이드 + 스케일 = ExerciseMotion, 탭하면 일시정지, prefers-reduced-motion이면 정지 상태로 시작
  → 근육명·자세 포인트는 한글로 직접 작성 (원본 영어 설명 미사용). 새 기본 종목은 bodyPart.ts EXERCISE_LIBRARY + EXERCISE_INFO 둘 다 추가
- 즐겨찾기: GET/POST/DELETE `/workouts/bookmarks` (종목명 문자열), toggleBookmark는 낙관적 업데이트 + 실패 시 롤백·토스트
  → 종목 시트 첫 탭 '★ 즐겨찾기'(있으면 기본 선택), 행마다 StarButton(행 버튼과 분리 — 버튼 중첩 금지), 상세 시트 헤더에도 별
- 종목 추가 흐름: 종목 시트 → 상세 시트(ExerciseDetail, mode='add') → 세트 설정(프리셋 5×5/3×8… + 세트·무게·횟수 스테퍼) → 추가
  → 카드 헤더 탭 = 상세 시트 mode='edit': 완료 세트는 유지하고 남은 세트에만 무게·횟수 적용
- 세트 종류 setType: NORMAL/WARMUP(W)/DROP(D)/FAILURE(F) — 세트 번호 칸 탭 → 메뉴. 웜업은 볼륨·1RM·월간 세트 수 집계에서 제외(isWorking)
  → 카드에 animate-rise-in(transform)이 있어 stacking context가 생김 → 메뉴 열린 카드는 relative z-20 필요 (없으면 바깥 클릭 오버레이가 메뉴를 덮음)
- 애니메이션 keyframes는 tailwind.config.js (sheet-up / fade-in / rise-in / pop)

## Layout 규칙
- 최상위 div: `overflow-hidden` — 뷰포트 고정
- 본문 wrapper: `flex flex-col flex-1 min-w-0` — overflow 없음
- main: `overflow-auto` — 가로/세로 스크롤 모두 담당 (overflow-x-auto나 overflow-y-auto 분리 금지)

## 폴더블·반응형 내비게이션 (2026-10 갤럭시 폴드 대응)
- 기준 화면: 폴드 커버(약 412px, 폰) / 폴드 펼침(약 700~900px, 정사각형에 가까움)
- < md: 상단 바(로고+다크모드) + **하단 탭 바**(홈·지출·플래너·운동·전체) — '전체'가 드로어를 엶, 햄버거 버튼 없음
  → 화면 고정 요소(FAB·Toast·InstallPrompt)는 모바일에서 `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`로 탭 바 위에 띄움
  → 드로어 오버레이는 z-50 (FAB z-40보다 위)
- md~lg(768~1023): 아이콘+작은 라벨 **레일 고정**(w-[72px]) — 전체 사이드바(224px)면 본문이 600px대로 줄어 표가 글자 단위로 깨졌음
- lg+: 기존 사이드바(접기 토글 유지)
- 루트 높이 `h-[100dvh]`(모바일 주소창 대응), viewport meta에 `viewport-fit=cover` + safe-area 패딩
- 표 ↔ 카드 리스트 전환은 **lg** 기준(`lg:hidden` / `hidden lg:block`) — md 기준이면 폴드 펼침 화면에서 표가 너무 좁음
- TodoPage: min-w-[800px] 금지 — 1열(모바일) → 2열+TimeBox 전체폭(md) → 3열(xl), 터치 기기는 Shift 대신 두 번째 칸 탭으로 블록 생성

## 세션 타임아웃 (2026-10-30)
- 1시간 무활동 → 자동 로그아웃: `utils/session.ts`(상수·판정) + `components/SessionTimeout.tsx`(Layout에 1개)
  → 활동은 localStorage 'lastActivity'(탭 공유, 15초 스로틀), 55분부터 카운트다운 시트, 60분 endSession('timeout') → 로그인 화면 안내 문구
  → 토큰 남은 시간 30분 미만이면 /auth/refresh — 서버 토큰도 1시간이라 둘 다 같이 바꿔야 함(IDLE_LIMIT_MS ↔ JwtUtil.EXPIRATION_MS)
  → 로그아웃은 항상 endSession()/logout() — localStorage 키를 직접 지우지 말 것. 401은 axios 인터셉터가 endSession('expired')

## 회원가입 (/signup, 2026-11-03)
- SignupPage: 아이디·이름·비밀번호·확인·월급일 → POST /members → 바로 /auth/login 후 홈으로. 로그인 화면 하단 '회원가입' 링크
  → 입력 규칙은 백엔드 MemberService.create와 같게 유지: 아이디 영문 소문자·숫자·_ 4~20자(입력 중 소문자 변환), 비밀번호 영문+숫자 8~64자, 이름 1~30자, 월급일 1~31
  → 오류는 칸을 벗어난 뒤(touched)부터 표시, 서버 메시지(중복 아이디 등)는 그대로 보여줌

## 회원 탈퇴 (2026-11-03)
- 화면 설정(/preferences) 맨 아래 components/WithdrawSection — '탈퇴' 입력 확인 시트 → DELETE /members/{id} → endSession('withdrawn')
- LoginPage: 409 + data.code==='WITHDRAWN'이면 삭제 예정일 + '계정 복구하고 로그인'(restore:true로 다시 로그인). 데이터는 30일 뒤 서버가 삭제 (backend CLAUDE.md '회원 탈퇴')

## 공통 UI (2026-10-29 정리)
- 알림은 전부 useToast() + <Toast /> — alert() 금지 (confirm은 삭제 확인에만)
- 달별 메모는 서버: hooks/useServerNote(key, legacyKey) — GET/PUT /notes/{budget|planner}-YYYY-MM, 예전 localStorage 값은 처음 열 때 옮기고 지움
- 이름 통일: 메뉴 = 페이지 제목 (지출 / 수입, 예산 설정, 현금 자산, 운동 기록, 월간 플래너, 오늘 플래너)
- 홈 '투자 납입' 카드: 실적 = 지출 '투자' 분류 합계, 계획 = 투자 계좌에 연결된 예산 항목 합계

## 사이드바 규칙
- 그룹(2026-10-29): 가계부(대시보드·지출/수입·고정비·리포트·예산 설정 — 돈의 흐름) / 자산(자산 현황·현금 자산·적금·청약·투자 현황·투자일기 — 쌓인 돈, 보기 전용) / Daily. 등록·수정은 하단 '내 계좌'
  → '자산 현황'은 /assets 이름 — 홈 대시보드 제목은 'N월 예산 현황' (같은 이름 쓰지 말 것)
- Layout.tsx: 상단 «/» 버튼으로 전체 slim 모드(w-14, 아이콘만) ↔ 전체(w-56) 토글
- 그룹: 가계부(대시보드·지출/수입·고정비·리포트·현금 자산) / 투자(투자 현황·투자일기) / Daily — 그룹 헤더 클릭으로 접기/펼치기
  → 투자 설정은 사이드바에 없음: 투자 현황 헤더 ⚙️ 설정 버튼으로 진입, /invest/settings에선 '투자 현황'을 활성 표시 + 상단 '← 투자 현황' 링크
- 설정(Config) 메뉴는 하단 버튼 영역에 위치 (nav 그룹에서 제거)
- 메뉴 아이콘은 이모지 금지 — `components/NavIcon.tsx` 선 아이콘(currentColor, 사이드바·하단 탭 공용). 새 메뉴는 PATHS에 아이콘 추가
- 그룹 레이블(가계부·자산·Daily)은 `text-slate-500 dark:text-slate-400` 11px — slate-400/600에 10px이면 색 테마 사이드바 배경에서 안 보였음 (2026-11-03)
- 사이드바/그룹 접힘 상태 localStorage 저장 ('sidebarCollapsed', 'collapsedGroups')

## FixedCostPage 규칙
- '매달 고정' / '할부' 섹션 분리, 각 섹션 금액 DESC (할부는 완납이 맨 아래)
- 합계는 응답의 countedThisMonth만 더함 — isActive로 더하면 시작 전·완납 할부까지 들어감 (대시보드 고정비 모달, BudgetSettingsPage도 동일)
- 할부 회차/남은 개월은 백엔드 계산값(paidMonths/remainingMonths) 표시 — 프론트에서 다시 계산하지 않음

## ExpensesPage 규칙
- BudgetType: '생활비' | '비상금' | '투자' — 백엔드 String 컬럼이라 추가 마이그레이션 불필요
- 투자 배지 색상: violet (생활비=emerald, 비상금=amber, 투자=violet)
- 지출 탭 필터: searchQuery(통합검색) + filterCategoryId + filterBudgetType → filteredExpenses
  → 예산구분 칩(전체/생활비/비상금/투자)과 카테고리 칩은 별도 줄로 분리
  → 월 변경 시 모든 필터·정렬 상태 초기화
- 수입 탭 필터: incomeSearchQuery(출처·메모) → filteredIncomes
- 컬럼 정렬: sortKey + sortDir(asc/desc) — 지출 6개 컬럼, 수입 3개 컬럼
  → 같은 컬럼 재클릭 시 방향 토글, 다른 컬럼 클릭 시 desc로 초기화
  → SortIcon(지출, primary색) / IncomeSortIcon(수입, blue색)
- 빈 결과: expenses.length===0 → "등록 없음", filteredExpenses.length===0 → "검색 결과 없음"

## DashboardHome 규칙
- 상단 요약 카드 4개: 가용금액 / 생활비·비상금 소진율(통합) / 카드 실적 / 주식 투자
  → 2026-07 개편: 기존 "생활비 소진율"/"비상금 소진율" 두 카드를 표시 레이어에서 하나로 통합
    (합산 예산 = livingBudget+emergencyBudget, 합산 지출 = livingExpenses+emergencyExpenses, 분모 0 가드)
    → EmergencyPage/BudgetSettingsPage 등 다른 페이지의 데이터 모델은 그대로 — 대시보드 "표시"만 통합
  → 통합·카드실적·주식투자 카드 클릭 시 지출 상세 모달(detailModalType 상태, 타입: '생활비'|'카드'|'투자')
  → detailModalItems: '카드'는 paymentMethod 필터, '생활비'는 budgetType이 생활비 OR 비상금인 것 모두, '투자'는 budgetType 필터
  → investExpenses: expenses.filter(e => e.budgetType === '투자') 클라이언트 집계
  → cardGoal 미설정(0)이면 퍼센트/진행바 대신 "카드 목표 미설정" 안내 — 500000 하드코딩 폴백 금지 (분모 0 가드)
- 지출 상세 모달: 모바일 바텀시트 + 데스크탑 중앙, 하단 "지출 페이지에서 보기 →" 링크
- "이번 달 예산 분배" 카드 배열: 고정비를 맨 앞에 추가 (실수령액에서 가장 먼저 빠지는 돈)
  → 고정비 퍼센트만 다른 카드와 분모가 다름: fixedCostTotal/netSalary*100 (다른 항목은 value/availableAmount*100) — netSalary 0 가드
  → 카드 6개 이상 가능해져 그리드 lg:grid-cols-6으로 확장
- 지출 등록 모달 카테고리 select: categories가 비어있으면(로딩 중/실패) select disabled + "카테고리를 불러오는 중..." 옵션, 저장 버튼도 disabled
  → categoryId 1~5 하드코딩 폴백 금지, handleSave에도 categories.length===0 가드 추가

## 투자 페이지 공통 (2026-10 개편 — 레퍼런스: 토스증권 / Daylio / 토스 설정)
- 수익 색: 상승·강세 = rose(빨강), 하락·약세 = blue (한국 증시 관례) — 일기의 시장 분위기 칩도 동일
- 피드백은 alert 대신 `components/Toast.tsx`의 useToast() + <Toast /> 사용 (confirm은 삭제 확인에만)
- 종목 색 팔레트(HOLDING_COLORS / SEGMENT_COLORS)는 대시보드 도넛·종목 컬러바·설정 비중바가 같은 순서로 공유

## InvestDashboardPage 규칙
- 상단: 총 평가금액 히어로 카드 + 현재 비중 도넛(평가금액 없으면 목표 비중으로 그림)
- 정렬: sortByValue — 계좌는 금액 합계 DESC, 계좌 안 종목도 금액 DESC (금액 = 평가금액, 현재가 없으면 원금 평균단가×수량)
  → 종목 색(colorOf)은 정렬 **전** 설정 순서로 매김 — 정렬 후 매기면 실시간 시세로 순위 바뀔 때 색이 바뀜
- 종목 행은 표가 아니라 리스트 행 — 평균단가/현재가/납입 진행 컬럼은 `xl:`에서만 같은 줄 (lg는 사이드바 때문에 폭 부족해 넘침)
- 상단 grid는 `grid-cols-1` 필수 — 빠지면 모바일에서 암묵적 auto 열이 콘텐츠 폭만큼 늘어나 가로 스크롤 생김
- 현재가/이달 납입 입력은 계좌 단위 바텀시트(sheetAccId), 저장은 Promise.allSettled + 실패 개수 토스트

- 실시간 시세: `hooks/useLiveQuotes.ts` (SSE를 fetch 스트림으로 읽음 — EventSource는 Authorization 헤더 불가) → applyLiveQuotes로 현재가·평가금액·손익·비중 재계산
  → **이번 달 화면에만** 적용 (지난 달은 저장된 현재가), 종목코드(stockCode) 있는 종목만, 헤더 LiveBadge: 실시간 / 네이버 시세 · 20초(status.provider==='NAVER', KIS 키 없을 때) / 장 마감·종가 기준 / 시세 연결 중 / 수동 현재가
- 페이지 목적 = 매달 "이번 달 할 일" → 증권 앱 실행 → '체결 완료' 순환. 맨 위가 할 일 카드, 평가금액·도넛·계좌는 그 아래 근거
  → 체결 완료 시트: POST /invest/holdings/{id}/trades {side, shares, price} — 백엔드가 보유 수량·평균단가(매수 가중평균, 매도 유지) 갱신
  → 이번 달 체결 내역은 GET /invest/trades?yearMonth, 되돌리기는 종목별 가장 최근 체결만(DELETE /invest/trades/{id})
  → 계좌별 쓸 수 있는 돈 = 납입금(토글) + 이번 달 매도 − 매수 — 체결 후 같은 추천이 다시 안 나오게
  → 같은 종목코드 두 줄인 계좌는 추천 대신 '설정에서 합치기' (utils/mergeHoldings.ts duplicateCodes)
- 리밸런싱 추천 카드(2026-10 납입 가이드 대체): `utils/rebalance.ts` rebalancePlan — 계좌 안에서만 계산(연금·ISA 간 이동 없음)
  → 목표 ±rebalanceThreshold(%p) 넘게 무거운 종목은 목표까지 매도(1주 단위 내림), 판 돈 + 이번 달 납입금(토글)으로 가벼운 종목 매수. 밴드 안이면 매도 안 함
  → 매도 종목은 다시 매수 대상에서 뺌, 매수 합계 = 납입금 + 매도 합계 (테스트 `utils/__tests__/rebalancePlan.test.ts`)
  → 보유 수량 있는데 현재가 없는 종목이 있으면 그 계좌는 추천 안 하고 '현재가 입력' 안내 (비중을 모름)
  → 색: 매수 rose / 매도 blue (토스증권 관례). 목표 0%인 보유 종목은 전량 매도로 나와서 경고 문구 표시
- 계좌 카드 헤더: 평가금액(text-2xl) + 수익률/손익 — statsOf()로 **현재가 있는 종목만** 손익 계산 (현재가 없는 종목 원금까지 넣으면 손실로 보임)
- allocateContribution/overweightAfter는 남아 있지만 화면에선 rebalancePlan만 사용
  → 테스트는 `utils/__tests__/` (CRA 5 glob 버그로 *.test.ts가 빌드 타입체크에 걸림 — __tests__ 폴더는 제외됨)

## 테마 기반 투자 관리 (2026-10)
- 사용자 방식: 전체 자산 4분할(현금·투자·부동산·적금) → 투자 안은 **테마**(미국 지수·AI·원자재·국내 지수·현금성)로 목표 % 고정, 종목은 테마 안에서 바뀔 수 있음
- 투자 설정 '테마' 탭: 테마 이름·목표 %(합계 100)·현금성 토글. '추천 테마로 시작' = utils/themeDefaults.ts DEFAULT_THEMES + 종목명 키워드 자동 배정(guessThemeIndex — 현금성을 먼저 매칭)
  → 저장 순서: POST /invest/themes 먼저(응답이 보낸 순서) → 새 테마 id를 themeKey('new:xx')로 찾아 holding.themeId 연결 → POST /invest/accounts
  → 테마가 있으면 계좌 안 종목 % 입력·검증 숨김(저장 시 균등으로 채움 — 이달 납입 계획 계산용), 종목 카드에 테마 select
  → 현금성 테마 종목은 주수 대신 '금액'(manualValue) 입력. 평가금액 = manualValue, 원금 없음 → 손익 계산 제외(statsOf)
- 투자 현황 테마 모드(themes.length > 0): ThemeTodo(이번 달 할 일) → 요약(테마 도넛) → ThemeBreakdown(테마별 현재/목표·소속 종목) → 계좌 카드
  → utils/themeRebalance.ts rebalanceByTheme: 밴드 넘은 테마 매도(현금성이면 '현금 사용'), 계좌별 돈(납입금+매도−매수)으로
    **살 수 있는 테마가 적은 계좌부터** 1주씩, 전체 기준 부족 비율이 가장 큰 테마의 그 계좌 종목을 매수, 목표 채운 테마는 안 삼, 못 쓴 돈은 '남는 돈'
    (라운드 로빈이면 선택지 많은 연금이 원자재를 먼저 채워 ISA 돈이 35만원 남았음 — 순서 바꾸지 말 것)
  → 중복 종목코드·현재가 없는 보유 종목이 있으면 계산 안 하고 blockers로 안내
  → '매도 없이 납입금으로만' 토글(localStorage 'themeAllowSell') = rebalanceByTheme(..., { sell: false }) — 주식 테마 매도 생략, 현금성 '사용'은 유지
  → 테마 없으면 예전 계좌 단위 추천(rebalancePlan) 그대로
- 위성 테마(satellite, 2026-11-02 — 코어-새틀라이트): 테마 설정 '위성' 칩(현금성과 배타). 목표 % = **상한**
  → rebalanceByTheme·assetGuide 둘 다: 위성은 납입금으로 매수 안 함, 상한+밴드 넘으면 매도(sell)·HOLD_BUY만
  → 코어 테마 목표 = (전체 − min(위성 보유, 상한)) × 코어끼리 비율 — 상한 전체를 비워두면 코어가 다 찬 걸로 보여 납입금이 '남는 돈'이 됨
  → ThemePanels: 위성은 '최대 N%' · '상한 안/상한 N%p 초과' 칩, 상한 넘으면 할 일 카드에 보라 안내
- '이번 달 납입금 포함' 토글 = 서버 InvestSetting.depositedMonth (PUT /invest/setting/deposited, 응답 contributionDeposited) — localStorage 금지
  → 납입금을 이미 예수금(현금성 금액)에 넣었으면 끔. 켜 두면 예수금 '현금 사용' + 납입금이 두 번 잡혀 쓸 돈이 부풀려짐 (기기마다 달라서 실제로 160만 원 추천이 나왔음)
  → 계좌 '쓸 돈' 표시 = budget + 그 계좌 USE_CASH 합계
- 매매 비용(2026-11-02): InvestSetting.feeRate(기본 0.015%)·priceBuffer(기본 0.5%) — PUT /invest/setting/trade-costs, 대시보드 응답에 기본값 채워 옴
  → rebalanceByTheme {feeRate, buffer}: 1주 비용 = 가격 + ceil(수수료) + ceil(가격 여유)로 쓸 돈 판정, TRAction.amount는 체결 금액(수수료 제외)·fee 별도, 결과 reserve(계좌별 여유)·fees
  → 매도는 수수료만큼 덜 들어옴. 세금은 계산에 안 넣고 화면 안내만: ISA·연금·IRP '지금 세금 없음', 일반 계좌 매도는 (체결가−평균단가)×주수×15.4% '최대'(국내 주식형은 비과세)
  → 환율은 국내 상장 ETF 원화 가격에 포함돼 따로 계산 안 함 — 안내 문구만
- 체결 → 예수금 연동(2026-11-02): POST trades가 같은 계좌 예수금 줄(종목코드 없음 + manualValue + 이름에 예수금/현금잔고)을 매수 −(금액+수수료, 남은 만큼만)/매도 +(금액−수수료) 조정, invest_trade.cashDelta에 기록 → 되돌리기 때 원복
  → 화면 쓸 돈 net은 tradeNet(): cashDelta 있으면 매도 0, 매수는 예수금으로 못 낸 부분만 (안 그러면 예수금과 체결이 두 번 빠짐)
- 현금성 테마는 밴드와 상관없이 목표 초과분을 꺼내 씀(USE_CASH) — 예수금이 밴드(5%p) 안이면 놀고 있었음. 매수 후 못 쓴 돈은 USE_CASH에서 되돌려 예수금에 둠
- 계좌 종류 PENSION/IRP/ISA/GENERAL — 라벨·인출 조건 문구는 `utils/accountLiquidity.ts` 단일 소스(세법 바뀌면 여기만), 페이지에 TYPE_LABEL 다시 만들지 말 것
  → 연금저축·IRP = 55세까지 묶인 돈, ISA·일반 = 꺼낼 수 있는 돈. 화면엔 LIQUIDITY_DISCLAIMER(참고용) 같이 표시
- 금액 줄(예수금·MMF·펀드): 종목코드 없이 manualValue — 평균단가만 있고 코드·수량 없는 줄은 불러올 때·저장할 때 manualValue로 옮김(priceOnlyToAmount), 계좌 단위 리밸런싱에선 제외
- 자산 배분 페이지: CASH=현금 자산 최신 잔액(/cash-assets 마지막), INVEST=투자 평가금액(시세 /invest/quotes 반영), MANUAL=직접 입력. 목표 대비 부족/초과 금액, 투자 칸 아래 테마 비중

## 투자 전략·납입 정책 (2026-10-29)
- 리밸런싱 모드(2026-11-03): 투자 방식은 사람마다 달라서 **기본은 기록 모드**, 목표 비중 맞추기는 켜는 기능 — 서버 rebalanceMode (backend CLAUDE.md)
  → 꺼지면: 투자 현황 할 일·테마 비중·목표 % 숨김, 종목 행 '매매' 버튼으로 체결 기록 / 자산 현황 목표 %·가이드 패널·테마 비중 숨김('칸별 자산') / 투자 설정 전략·리밸런싱 기준·매도·테마 탭 숨김, 종목 % 검증 생략(저장 때 균등)
  → rebalanceModeChosen=false(새 사용자)면 투자 현황 맨 위에서 한 번 물어봄. 스위치는 투자 설정 기본 탭 맨 위(저장바 없이 바로 저장)
  → 새 할 일·목표 화면을 만들면 rebalance 조건 안에 넣을 것
- 사실(계좌·종목) / 전략(납입·목표·매도) / 계산(rebalance*) 분리. 전략은 서버 저장 — localStorage 'themeAllowSell'은 폐기
- 계좌 납입금: acc.monthlyAmount (비우면 월 투자금 × 계좌 %). 대시보드는 응답의 acc.contribution 사용 — monthlyBudget × targetPct 직접 계산 금지
- 프리셋 `utils/strategyPresets.ts` (테스트 __tests__/strategyPresets.test.ts): 질문 3개 → recommendPreset, splitContribution(LIQUIDITY=ISA 전부 / TAX=연금 50만→IRP 25만→ISA / EQUAL=계좌 %)
  → 적용은 폼 값만 바꿈(저장바로 저장). 종목·상품은 추천하지 않음
- 비중 맞출 때 팔기도 하기(allowSell): 투자 설정 스위치 + 대시보드 토글 둘 다 /invest/setting 저장. rebalancePlan·rebalanceByTheme 둘 다 { sell } 옵션
- 계좌 목적·쓸 날짜 `utils/goalRisk.ts`: 날짜 있는 비노후 계좌만 남은 개월별 위험자산 상한(36개월 초과 없음 / 60 / 40 / 20%) 넘으면 대시보드 안내(참고용)
- 예산 설정 항목마다 '투자 계좌' 연결 select — 최신 달 저장 시 서버가 계좌 납입금 동기화
  → 연결이 하나도 없는 달은 항목명으로 자동 연결 제안(utils/accountLink.ts suggestLinks — IRP→ISA→연금 순 매칭), 달마다 한 번
  → 투자 설정에서 연동 계좌(GET /invest/accounts linkedBudgetLabel)는 월 납입금 읽기 전용 + 예산 설정 링크, 프리셋은 연동 안 된 계좌만 나눔
- 세액공제 계산기 입력은 회원별 서버 저장(PUT /invest/setting/tax-inputs) — localStorage taxCalcResult 읽기 금지 (docs/tax-calc.md '저장')
  → '세액공제 우선' 프리셋은 회원 연봉 기준 추천액(pensionMonthly/irpMonthly)까지만 연금·IRP에, 없을 때만 법정 한도 50만/25만

## 내 계좌 (/accounts, 2026-10-29)
- 계좌 등록·수정은 여기 한곳 — 다른 화면(현금 자산·적금·투자 현황·자산 배분)은 보여주기만. 사이드바 하단 '내 계좌'(설정 위)
  → 탭: 현금(components/CashAccountsPanel) / 적금·청약(<SavingsPage embedded />) / 투자(<InvestSettingsPage embedded />). embedded면 페이지 제목 숨김
  → /savings 단독 화면은 보기 전용: 카드·추가 버튼 누르면 /accounts?tab=savings로. 투자 설정 링크는 모두 /accounts?tab=invest
- 현금 계좌: GET/POST/PUT/DELETE /cash-accounts, PATCH /cash-accounts/{id}/active — 변경 API는 ?settleMonth=getCurrentSettleMonth() 필수
  → 서버가 그 달 cash_asset.balance = 켜진 계좌 합계로 맞춤 → 현금 자산 추이·자산 배분 CASH 칸은 그대로 cash_asset을 읽음
  → 계좌가 0개면 예전 방식(현금 자산 화면 직접 입력). 계좌가 있으면 EmergencyPage 입력 폼 대신 '현금 계좌 관리 →' 안내
  → 계좌 0개 + 기록 있음이면 최신 잔액을 '기본 현금' 계좌로 가져오기 버튼 (자동 생성 안 함 — 다 지운 사용자에게 다시 생기면 안 됨)
- 현금 잔액 자동 반영(2026-11-02, 서버 CashFlow — backend CLAUDE.md): 계좌 balance는 서버 계산 현재 잔액, baseBalance = 마지막으로 맞춘 값
  → 반영 항목: 지출·수입·카드값(정산월 끝)·월급−고정비(다음 달부터)·적금·청약 납입(납입일)
  → 적금 이체는 지출 폼 '적금·청약 납입' select(savingsId)로 적음 — 그 정산월 자동 납입 대신 지출이 빠짐(두 번 안 빠짐). 고르면 빈 이름·금액 채우고 카드→이체
  → 적금 카드 PaymentStrip: utils/savings.ts recentRounds(최근 3회 + 다음, 정산월 매칭 — 테스트 __tests__/savingsRounds.test.ts) 기록됨 ✓ / 기록 없음 / 예정
  → GET /cash-accounts·/cash-assets는 항상 ?settleMonth=getCurrentSettleMonth() 붙여 호출 (현금 자산·자산 현황·예산 설정·내 계좌 4곳)
  → 수정 시트 잔액에 현재 잔액을 채워 보냄 — 다른 값이면 서버가 '잔액 맞추기'. 프론트에서 잔액을 더하고 빼지 말 것
  → 지출 폼 칸은 components/ExpenseLinkFields.tsx 공용(useExpenseLinks, ExpenseAccountField, SavingsSelect, SavingsBadge) — 지출 / 수입 화면과 대시보드 지출 등록 둘 다 ('' = 기본 계좌, 카드는 '카드값 나가는 계좌')
  → 현금 자산 화면: auto 달은 '자동' 배지, 최신 달이 auto면 '이번 달 말 예상 잔액'(이번 달 카드값까지 뺀 값)
- 예산 항목 연결: 투자 계좌(investAccountId) 또는 적금·청약(savingsId) 중 하나 — select 값 'invest:ID' / 'savings:ID'
  → 최신 달 저장 시 적금 monthlyAmount도 예산 금액으로 바뀜(원금 = 월납 × 회차 계산이라 과거 회차 원금도 같이 바뀜 — 금액이 바뀐 적금은 paidOverride/잔액 확인)
  → suggestLinks(items, accounts, savings): 적금 이름 포함 매칭 먼저, '청약' 항목 → 주택청약, 그다음 투자 계좌 규칙

## 자산 현황 리밸런싱 가이드 (2026-10-29)
- `utils/assetGuide.ts` assetGuide(buckets, themes, {band 2%p, themeBand = 투자 설정 리밸런싱 기준, allowSell}) — 테스트 __tests__/assetGuide.test.ts
  → 칸 사이: 넘치는 현금·투자 → 모자란 현금·투자·적금, 큰 차이끼리 먼저, 만원 단위 내림. 직접 입력(부동산)·적금 넘침은 옮기지 않고 stuck 안내
  → 투자 안: '옮긴 뒤 투자 금액' × 테마 목표% − 현재. allowSell=false면 넘친 테마는 HOLD_BUY, 매수 합계를 들어오는 돈에 맞춰 비례 축소
- `components/AssetGuidePanel.tsx`: xl은 오른쪽 360px sticky, 모바일은 요약 → 가이드 → 목표 배분 순서 (grid-cols-1 + col/row-start)

## SavingsPage 규칙 (적금)
- 고정비(사라지는 돈)와 분리 — 적금은 자산. 자산 배분 SAVINGS 칸 금액 = 적금 현재 원금 합계(만기 지나도 삭제 전까지 포함)
- 계산은 utils/savings.ts (테스트 utils/__tests__/savings.test.ts): 매달 시작일과 같은 날 납입(말일 보정), 단리 이자 = 월납 × 이율 × n(n+1)/2 ÷ 12, 일반과세 15.4%(10원 절사)
  → 납입 회차는 날짜로 자동, 실제와 다르면 paidOverride로 직접 입력. 날짜는 toYmd 로컬 기준
- 상태: ACTIVE(납입 중) / DONE(납입 완료, 만기 전) / MATURED(만기 — 수령 후 삭제 안내)
- 정부기여금(청년미래적금 등): monthlyBonus(월) + bonusBalance(앱의 현재 적립액, 비우면 월 × 회차) — 적금 전용, 청약은 저장 시 null
  → summary.current = 원금 + 기여금 (요약 카드·자산 배분은 current), 만기 수령액에 월 기여금 × 기간 더함, 기여금 이자는 미반영
  → 우대금리는 별도 칸 없이 연 이율에 합산해서 입력
- 수정 시트에서도 적금 ↔ 주택청약 종류 변경 가능
- 주택청약종합저축(kind=HOUSING, 2026-10): 만기 없음 — 백엔드는 months=0으로 저장, 만기 관련 값(taxFree) 무시
  → utils/savings.ts housingSummary (테스트 __tests__/housing.test.ts): 원금 = 은행 잔액(balanceOverride) 우선, 이자는 금리가 낮아 원금에 안 더함
  → 청약 인정 금액: 회차마다 min(월납, 한도) — 2024-11-01 전 10만 / 이후 25만
  → 민영 예치금(region별 85/102/135/모든 면적), 1순위 가입기간(6/12/24개월), 소득공제(무주택 세대주, 연 300만 × 40%)
  → 자산 배분 적금 칸은 currentPrincipal(종류별)로 합산 — savingsSummary 직접 쓰면 청약이 0원/만기 계산으로 잘못 들어감

## InvestDiaryPage 규칙
- 왼쪽 감정 달력(이모지) + 이번 달 감정 분포 / 오른쪽 타임라인. 날짜 클릭 → 기록 있으면 카드로 스크롤, 없으면 그 날짜로 작성
- 날짜 문자열은 toYmd() 로컬 기준 — toISOString()은 UTC라 KST 오전 9시 전 '오늘'이 어제가 됨
- 백엔드 POST /invest/diary는 날짜 기준 upsert → 수정 중 날짜를 바꾸면 저장 후 옛 id DELETE 필요, 같은 날짜 기존 기록은 폼에서 덮어쓰기 경고

## InvestSettingsPage 규칙
- 계좌 사용 토글(active, 2026-10-29): 끄면 카드 흐리게 + 안내, 납입금 0·프리셋 분배 제외. 투자 현황에선 회색 배지·맨 아래·입력 버튼 숨김
  → 스위치는 투자 설정·투자 현황 둘 다, **저장바 없이 바로 저장** PATCH /invest/accounts/{id}/active (새 계좌만 저장바로)
  → 정렬 offLast(안정 정렬) — 설정은 토글 즉시 옮기고 그 카드로 스크롤 + savedSnapshot의 같은 계좌도 바꿔 다른 미저장 변경은 유지
  → 계좌 모드 plans·테마 모드 themeAccounts에서 제외 — 단 종목은 themeHoldings에 남겨 테마 비중엔 포함 (rebalanceByTheme은 accounts에 없는 계좌 종목을 매매 안 함)
  → 예산 설정 자동 연결도 꺼진 계좌 제외, select에 '(꺼짐 — 납입 0원)' 표시
- 탭 구조: '기본 설정' / '계좌 & 종목' — activeTab state로 전환
  → 기본 설정 탭: 월 투자금/리밸런싱 기준/연금 세액공제 한도(설정 행 리스트) + 세액공제 추천 카드
  → 계좌 & 종목 탭: 계좌 비중바 + 계좌 카드(종류 세그먼트, 비중, 종목 비중바, 균등 분배)
- 같은 계좌에 같은 종목코드 두 줄 → 경고 배너 + '한 줄로 합치기'(mergeDuplicates: 목표 비중 큰 줄 유지, 비중·수량 합계, 평균단가 가중평균) + 저장 차단(백엔드도 400)
- 저장은 하단 sticky 저장바 하나 — setting과 accounts를 모두 한 번에 POST (탭별 분리 저장 아님)
  → savedSnapshot과 비교해 변경 있을 때만 활성, 검증 오류(비중 합계·이름 누락)는 저장바에 첫 번째 메시지 표시
- 종목 카드 '수익률로 계산' → AvgPriceCalc 패널: 현재가(1주) 또는 평가금액(총액) + 수익률 → 평균단가 역산(`utils/avgPrice.ts`, 테스트 `utils/__tests__/avgPrice.test.ts`)
  → 평균단가 = 값 ÷ (1+수익률), 평가금액 기준은 ÷ 보유 수량까지. 적용은 폼 값만 바꿈 — 저장바로 저장해야 반영

## BudgetSettingsPage 규칙
- 분배 입력 모드: '비율' ↔ '금액' 토글 (localStorage 미저장, 세션 내 유지)
  → 비율 모드: % 입력 → 금액 자동 표시
  → 금액 모드: 금액 입력 → % 자동 계산, 합계가 가용금액과 일치해야 저장 가능
  → 저장 시 항상 비율로 변환해서 백엔드 전송 (API 변경 없음)
- 항목명 편집: '편집' 버튼 클릭 → 인라인 수정 → '저장' → allocationLabels.ts에 반영

## 월별 분배 비율 동적 설정 규칙
- MonthlyBudget 엔티티에 livingRate / isaRate / pensionRate / emergencyRate / discretionaryRate 5개 컬럼 (DECIMAL(5,4)) 추가
- DB 저장값: 소수 (0.35, 0.25...) / 프론트 상태: 정수 퍼센트 (35, 25...) → 저장 시 / 100 변환
- 백엔드에 하드코딩 fallback 없음 — DB 값이 단일 소스
- DEFAULT_RATES (35/25/15/15/10): UI에서 신규 달 진입 시 예산이 전혀 없을 때만 사용하는 초기값
- 신규 달 진입 시 이전 달 예산(settleMonth 기준 가장 최근)의 비율·월급·카드목표 자동 적용
- BudgetSettingsPage 드롭다운: 항상 다음 정산월을 목록 맨 앞에 추가 (신규 달 미리 설정 가능)
- 비율 합계 !== 100% 시 저장 버튼 disabled
- 비율 input: type="number" step={1}, onChange에서 Math.floor() 적용 (소수 입력 방지)
- DashboardService / MonthlyBudgetService: 계산 시 entity의 rate 값 사용 (하드코딩 금지)

## 예산 항목 이름 (2026-10-29)
- allocationLabels.ts(localStorage 고정 5칸 이름)는 삭제 — 항목 이름은 서버 allocationItems.label이 단일 소스
- 리포트는 그 달 allocationItems를 그대로 표시('생활비'는 생활비 칸), 항목 없는 옛 달만 ISA/연금 고정 칸
- 생활비·비상금 예산 = 같은 이름 항목 금액 (서버 DashboardService.labeledAmount) — 레거시 비율 0인 달도 맞게

## UI 디자인 시스템 (Toss/Banksalad 스타일)
적용 파일: Layout.tsx, App.tsx(Dashboard), ExpensesPage, FixedCostPage, ReportPage, EmergencyPage, BudgetSettingsPage

### 사이드바
- 그룹 토글 없음 — 플랫 네비게이션
- 활성 항목: `border-l-[3px] border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600`
- 비활성 항목: `border-l-[3px] border-transparent text-slate-500`
- 그룹 레이블: `text-[10px] font-semibold uppercase tracking-widest text-slate-400`

### 페이지 헤더 패턴
```tsx
<div>
  <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">컨텍스트 설명</p>
  <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">페이지 제목</h1>
</div>
```
- 월 선택기: `rounded-full` 필 스타일
- 추가 버튼: `rounded-full px-4 py-1.5` 필 스타일

### 카드
- `rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none` — 테두리 없음
- 큰 숫자: `text-3xl font-bold tabular-nums`

### 테이블
- 헤더: `bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400` (uppercase 금지)
- 행 구분선: `divide-slate-50 dark:divide-dark-border/50`
- 행 hover: `hover:bg-primary-50/30 dark:hover:bg-slate-800/30`

### 뱃지
- `rounded-full px-3 py-1 text-xs font-medium` — rounded-md 사용 금지

### 모달
- `rounded-3xl shadow-2xl` — 테두리 없음

## 과거 실수 기록
- 월급일은 로그인 때만 localStorage에 저장 → 다른 기기에서 바꾸면 정산월 어긋남. components/SalaryDaySync(Layout)가 앱 열 때 서버 값과 맞추고 바뀌었으면 한 번 새로고침 (2026-11-02)
- 만기 지난 적금은 자산 현황 적금 칸·적금 합계에서 0 — 만기 수령액은 서버가 만기일에 현금 잔액에 더함 (currentPrincipal)
- 날짜 문자열을 `new Date().toISOString().split('T')[0]`로 만들면 KST 0~9시엔 어제 — 25일 아침 지출이 지난 정산월로 들어갔음 (2026-11-02)
  → 항상 utils/format.ts toYmd / todayYmd / parseYmd. '오늘'을 모듈 상수로 두지 말고 렌더 안에서 todayYmd() (자정 지나도 갱신)
- 대시보드 지출 등록이 settleMonth: selectedMonth(보고 있는 달)였음 → getSettleMonthForDate(expenseDate). 서버도 정산월로 예산을 다시 찾음
- TimeBox Block: 예전 table(rowSpan) 렌더링은 30분 경계 블록을 1시간으로 그렸음(저장은 30분 단위였는데 화면만 틀림)
  → CSS grid + blockPieces 조각 렌더링으로 해결 (2026-10-29)
- flex 자식에 overflow-auto 줘도 스크롤 안 되는 경우: min-h-0 누락 (min-height:auto 기본값)
  → `flex-1 min-h-0 overflow-auto` 조합 필수
- category.name으로 접근 시 undefined → categoryName 필드 사용
- resetForm()에서 setCategoryId(1) 하드코딩 → categories[0].id 사용
- monthlyBudgetId: 1 하드코딩 → API 조회 후 사용
- 월 옵션 하드코딩 → 저장된 월만 API로 조회해서 사용
- BudgetSettingsPage 저장 시 분배금액 전송 불필요 → netSalary/cardGoal/livingCarryover만 전송
- Promise.all 사용 시 summary API 실패(예산 없는 달)로 전체 데이터 로드 실패 → Promise.allSettled로 수정
- axios baseURL을 http://localhost:8888/api로 설정 시 외부 배포 환경에서 API 호출 실패 → /api 상대경로로 수정
- TodoPage useSearchParams: useState 초기값만으로는 이미 마운트된 상태에서 날짜 파라미터 변경 미반영
  → useEffect로 searchParams 변화 감지 추가 필수
- 달력 grid에서 last:border-r-0은 전체 마지막 셀에만 적용 → [&:nth-child(7n)]:border-r-0 사용
- 새 페이지 추가 시 SpaController + SecurityConfig 두 곳 모두 경로 추가 필수
- 카카오맵 useKakaoLoader 대신 index.html script 태그 직접 로드 — react-kakao-maps-sdk 컴포넌트도 window.kakao 전역 사용으로 대체
- 카카오 도메인 등록: 플랫폼 > Web이 아닌 플랫폼 키 > JavaScript 키에서 직접 등록
- Layout main에 overflow-x-auto/overflow-y-auto 분리 적용 시 스크롤 방향 충돌 → overflow-auto로 통합
- InvestRecordsPage togglePaid: isPaid 토글 시 currentPct: null 전송하면 기존 비중 초기화됨
  → togglePaid에 currentPct 파라미터 추가해서 기존 값 그대로 전송해야 함 (현재는 InvestDashboardPage에 통합)
- InvestDashboardPage 로딩 상태: useState(false) 초기값이면 데이터 로드 전 빈 화면 flash 발생
  → loading 초기값은 true로 설정해야 함