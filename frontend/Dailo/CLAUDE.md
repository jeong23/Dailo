# Dailo Frontend

## 프로젝트 개요
- React 19 + TypeScript + Tailwind CSS + Recharts
- 포트: 3000 (개발 시), 배포 시 Spring Boot(8888)에서 정적 서빙
- API 백엔드: /api (상대경로 — Spring Boot 정적 서빙 기준)

## 실행
- npm start

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
| /expenses | ExpensesPage | 지출/수입 통합 관리 (탭) |
| /fixed-costs | FixedCostPage | 고정비 관리 |
| /report | ReportPage | 월별 정산 리포트 |
| /emergency | EmergencyPage | 비상금 누적 흐름 |
| /settings | BudgetSettingsPage | 월별 예산 설정 |
| /todo | TodoPage | 일일 플래너 (SIMOL 다이어리 구조) |
| /planner-board | PlannerBoardPage | 월간 플래너 보드 (달력 뷰) |
| /running | RunningPage | 운동 기록 (NRC 스타일) |

## 핵심 유틸 (src/utils/format.ts)
- formatNumber(value): 숫자 → "1,000,000" 콤마 포맷
- parseNumber(value): "1,000,000" → 숫자
- getCurrentSettleMonth(): 오늘 기준 정산월 반환 (25일 이후면 다음 달)
- getMonthOptions(count=6): 현재 정산월부터 N개월 옵션 배열

## 주요 타입 (src/types/index.ts)
- DailyExpense: categoryName(string) 필드 있음 — category.name 아님
- DashboardSummary: extraIncomeTotal 포함
- BudgetType: '생활비' | '비상금'

## 상태 관리 규칙
- monthlyBudgetId: 하드코딩 1 금지 → /monthly-budgets/member/1/month/{월} API로 조회
- categoryId 초기값: 하드코딩 1 금지 → categories[0].id 사용
- selectedMonth 초기값: 하드코딩 금지 → getCurrentSettleMonth() 사용
- monthOptions: getMonthOptions() 금지 → /monthly-budgets/member/1 API로 저장된 월만 조회
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
- 개발: `npm start` (포트 3000, axios baseURL은 /api 이므로 proxy 설정 필요 또는 백 직접 접근)
- 배포: `npm run deploy` — 빌드 + Spring Boot static 폴더 복사 한번에 처리
  - 빌드 결과물(`build/`)을 백엔드 `src/main/resources/static/`에 복사하는 이유:
    Spring Boot가 해당 폴더를 웹으로 서빙하기 때문 (프론트/백 서버를 8888 하나로 통합)
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
- SpaController에 `/running` 경로 추가 필수
- SecurityConfig permitAll에 `/running` 경로 추가 필수
- 백엔드 엔티티: RunningGoal (월별 목표), RunningRecord (개별 기록)
- RunningRecord 필드: ran, title, distanceKm, durationSeconds, calories, elevationGain, avgHeartRate, cadence, memo, routeJson
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

## 과거 실수 기록
- TimeBox Block 디자인: time.jpeg 참고 — 3열(시간|30mins|30mins), 블록=colSpan2+rowSpan N
  30분 단위 병합(8:30~9:00)은 HTML table 구조상 구현 불가 → 시간 단위로만 가능
- flex 자식에 overflow-auto 줘도 스크롤 안 되는 경우: min-h-0 누락 (min-height:auto 기본값)
  → `flex-1 min-h-0 overflow-auto` 조합 필수
- category.name으로 접근 시 undefined → categoryName 필드 사용
- resetForm()에서 setCategoryId(1) 하드코딩 → categories[0].id 사용
- monthlyBudgetId: 1 하드코딩 → API 조회 후 사용
- 월 옵션 하드코딩 → /monthly-budgets/member/1 API로 저장된 월만 사용
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

## 세액공제 최적화 계산기 (InvestSettingsPage 하단)

파일: `src/pages/InvestSettingsPage.tsx` — 컴포넌트 외부 순수 함수로 구현, 자동 반영 없음 (읽기 전용 출력).

### 입력값
- 월 실수령액, 수습 여부 체크박스, 수습 종료 예정월(수습 시), 입사월

### 역산: 실수령액 → 세전 월급 (`calcGrossFromNet`)
4대보험 공제율 (직원 부담분):
- 국민연금 4.5% / 건강보험 3.545% / 장기요양 = 건강보험×12.81% / 고용보험 0.9%
- 소득세+지방소득세 = `calcAnnualTax(gross×12) / 12`
- 위 5항목 합산이 (gross - net)에 수렴할 때까지 반복 (최대 80회, 허용오차 10원)

수습 체크 시: `probGross = calcGrossFromNet(net)` → `regGross = probGross / 0.8`
수습 없음: `regGross = calcGrossFromNet(net)`

### 연간 소득세 (`calcAnnualTax`)
1. **근로소득공제** (소득세법 §47):
   - ≤500만: ×70% / 500~1,500만: 350만+초과×40% / 1,500~4,500만: 750만+초과×15%
   - 4,500~1억: 1,200만+초과×5% / >1억: 1,475만 (한도)
2. **과세표준** = 총급여 − 근로소득공제 − 기본인적공제 150만
3. **누진세율** (소득세법 §55):
   ≤1,400만 6% / ~5,000만 15% / ~8,800만 24% / ~1.5억 35% / ~3억 38% / ~5억 40% / ~10억 42% / 초과 45%
   (누진공제: 0/84만/624만/1,536만/3,706만/9,406만/17,406만/38,406만)
4. **근로소득세액공제** (소득세법 §59): 산출세액 ≤50만→×55%, 초과→27.5만+초과×30%
   한도: 총급여 ≤3,300만=74만 / ≤7,000만=66만 / 초과=50만
5. **반환값** = (산출세액 − 세액공제) × 1.1 — 지방소득세 10% 포함 (세액공제율 16.5%=15%×1.1과 정합)

### 세액공제율
- 총급여(=regGross×12) ≤5,500만 → **16.5%** / 초과 → **13.2%**

### 연금저축 추천납입액
- `pensionAnnual = min(annualTax / creditRate, 600만)` (만원 단위 반올림)
- `pensionRefund = pensionAnnual × creditRate`
- `pensionMonthly = pensionAnnual / remainMonths` (remainMonths = 13 − 입사월)

### IRP 추천납입액
- `remainTax = annualTax − pensionRefund`
- remainTax ≤ 0 → **IRP 불필요**
- remainTax > 0 → `irpAnnual = min(remainTax / creditRate, 300만)`, `irpMonthly = irpAnnual / remainMonths`

ISA는 세액공제 없으므로 안내 문구만 표시.

## 다음 작업 후보
- [ ] 로그인/인증 페이지 (JWT) - 현재 memberId: 1 하드코딩
