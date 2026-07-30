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
| /expenses | ExpensesPage | 지출/수입 통합 관리 (탭) |
| /fixed-costs | FixedCostPage | 고정비 관리 |
| /report | ReportPage | 월별 정산 리포트 |
| /emergency | EmergencyPage | 비상금 누적 흐름 |
| /settings | BudgetSettingsPage | 월별 예산 설정 |
| /todo | TodoPage | 일일 플래너 (SIMOL 다이어리 구조) |
| /planner-board | PlannerBoardPage | 월간 플래너 보드 (달력 뷰) |
| /running | RunningPage | 운동 기록 (NRC 스타일) |
| /habits | HabitPage | 습관 트래커 |
| /invest | InvestDashboardPage | 투자 현황 |
| /invest/diary | InvestDiaryPage | 투자일기 |
| /invest/settings | InvestSettingsPage | 투자 설정 |

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

## 다크모드
- Tailwind class 전략 사용
- localStorage 'darkMode' 키로 저장
- 기본값: 다크모드 ON

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
- Brain Dump ↔ Big3 드래그앤드롭: HTML5 DnD API 사용
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
  - 블록 렌더링: time.jpeg 참고 디자인 — 3열(시간 | 30mins | 30mins), 블록은 colSpan=2+rowSpan=N
  - 블록 색상: 내용 없음=회색, 내용+미완료=빨강 border+배경, 완료=초록 border+배경
  - 블록은 시간 단위(hour-level)로만 병합 가능 — 30분 단위 병합은 HTML table 구조상 불가
  - slotToIndex(hour, slot) = (hour - 5) * 2 + slot
  - getCoveringBlock(hour, slot): 해당 슬롯을 덮는 블록 탐색
- 플래너 레이아웃 스크롤: root div `h-full flex flex-col` + 콘텐츠 wrapper `flex-1 min-h-0 overflow-auto`
  - flex 자식에 overflow-auto만으론 스크롤 안 됨 — `min-h-0` 필수 (min-height: auto 기본값 때문)

## PlannerBoardPage 규칙
- {year, month} 단일 state 객체로 관리 — 분리 시 useEffect가 두 번 발화해 이중 API 호출
- 달력 셀 border: `[&:nth-child(7n)]:border-r-0` 사용 — `last:border-r-0`은 마지막 셀 하나에만 적용됨
- 셀 클릭 → navigate(`/todo?date=${ds}`) 로 TodoPage 연동
- 모바일 가로 스크롤: overflow-x-auto wrapper + min-w-[480px] 로 처리

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

## Layout 규칙
- 최상위 div: `overflow-hidden` — 뷰포트 고정
- 본문 wrapper: `flex flex-col flex-1 min-w-0` — overflow 없음
- main: `overflow-auto` — 가로/세로 스크롤 모두 담당 (overflow-x-auto나 overflow-y-auto 분리 금지)

## 사이드바 규칙
- Layout.tsx: 상단 «/» 버튼으로 전체 slim 모드(w-14, 아이콘만) ↔ 전체(w-56) 토글
- Money / Daily 그룹 헤더 클릭으로 섹션 접기/펼치기 가능
- 설정(Config) 메뉴는 하단 버튼 영역에 위치 (nav 그룹에서 제거)
- 사이드바/그룹 접힘 상태 localStorage 저장 ('sidebarCollapsed', 'collapsedGroups')

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

## InvestSettingsPage 규칙
- 탭 구조: '기본 설정' / '계좌 & 종목' — activeTab state로 전환
  → 기본 설정 탭: 세액공제 추천 카드 + 월 투자금/리밸런싱 트리거/연금 세액공제 한도 + 저장
  → 계좌 & 종목 탭: 계좌 추가·편집, 종목 비중 설정 + 저장
- 저장하기 버튼은 setting과 accounts를 모두 한 번에 POST (탭별 분리 저장 아님)

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

## allocationLabels.ts
- 예산 분배 항목명(생활비/ISA/연금저축/비상금/자유재량) localStorage 관리
- getAllocationLabels() / setAllocationLabels() 사용 — BudgetSettingsPage에서 편집 가능

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
- TimeBox Block 디자인: time.jpeg 참고 — 3열(시간|30mins|30mins), 블록=colSpan2+rowSpan N
  30분 단위 병합(8:30~9:00)은 HTML table 구조상 구현 불가 → 시간 단위로만 가능
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