# Dailo Backend (backend/Dailo)

> 공통 규칙은 루트 `CLAUDE.md` 참고. API 엔드포인트 전체 목록은 `docs/api-reference.md`.

## 개요
- Spring Boot 3.5.x + Java 17 + JPA + MariaDB
- 빌드: Maven — **`mvn`이 PATH에 없으므로 반드시 `./mvnw` 사용** (`./mvnw compile`, `./mvnw spring-boot:run`, `./mvnw test`)
- 패키지: com.dailo.app
- 포트: 8888
- DB: localhost:3333 / budget_dashboard

## 패키지 구조
```
com.dailo.app
├── controller
├── service
├── repository
├── entity
├── dto
├── config
├── security
└── common
```

## 핵심 규칙
- application.yml 절대 커밋 금지
- Entity에 @CreatedDate, @LastModifiedDate 사용 (BaseEntity 상속)
- DTO ↔ Entity 변환 필수 (Entity 직접 반환 금지)
- REST API는 /api/ 접두사 사용
- 예외는 GlobalExceptionHandler에서 처리
- 모든 응답은 ApiResponse<T> 공통 포맷 사용
- ApiResponse 메서드명: ApiResponse.ok() 사용 (success() 아님)

## DB 테이블 목록
- MEMBER (회원 — username, password, name, role, salaryGross, salaryDay)
- MONTHLY_BUDGET (월별 예산)
- DAILY_EXPENSE (일일 지출 — settleMonth는 expenseDate 기준 자동 계산)
- CATEGORY (카테고리)
- FIXED_COST (고정비 — cost_type RECURRING|INSTALLMENT(null=RECURRING), 할부는 installment_start/months/end)
- INCOME (기타 수입 - 이자, 환급금 등)
- DAILY_PLAN (일일 플래너 — memberId, 미래시각화/정체성/내적동기/감사일기/기상직후할일/피드백, UNIQUE(member_id, plan_date))
- TODO_ITEM (할 일 — memberId, type: BIG3 | BRAIN_DUMP, isDone, sortOrder)
- TIME_BOX_SLOT (타임박스 — memberId, hour(5~23), slot1/slot2 텍스트, slot1Done/slot2Done, UNIQUE(member_id, plan_date, hour))
- TIME_BOX_BLOCK (타임박스 블록 — memberId, planDate, startHour, startSlot, endHour, endSlot, content, isDone)
- HABIT (습관 — memberId, name, emoji, color, isActive, sortOrder)
- HABIT_LOG (습관 체크 기록 — habit_id, log_date, UNIQUE(habit_id, log_date))

## 인증 (JWT)
- 방식: Stateless JWT (jjwt 0.12.6), **1시간 만료**(JwtUtil.EXPIRATION_MS) — 사용 중엔 프론트가 POST /api/auth/refresh로 연장
  → 인증 실패는 SecurityConfig authenticationEntryPoint가 401 JSON (기본 403이면 프론트가 만료를 몰라 로그아웃 안 됨)
- 필터: JwtAuthenticationFilter (OncePerRequestFilter) — Authorization: Bearer 헤더 파싱
- 컨트롤러에서 memberId 주입: @AuthenticationPrincipal CustomUserDetails userDetails
- CustomUserDetails 필드: memberId, username, password, name, salaryDay
- permitAll: /api/auth/**, /api/members (POST), SPA 라우트, 정적 파일
- authenticated: /api/** 전체 (위 제외)

## 비즈니스 규칙
- 월급일: Member.salaryDay (기본값 25) — 설정 페이지에서 사용자가 직접 변경 가능
- 정산 기간: 전월 {salaryDay}일 ~ 당월 {salaryDay-1}일
- 지출/수입 settleMonth: expenseDate / incomeDate 기준으로 프론트에서 자동 계산
  → format.ts의 getSettleMonthForDate(dateStr) 사용 (localStorage salaryDay 기준)
  → 드롭다운 selectedMonth와 무관하게 날짜 기준으로 정산월 결정
- memberId: 프론트 전역에서 getStoredMemberId() 사용 — 하드코딩 1 절대 금지
- 예산 분배: 생활비 35% / ISA 25% / 연금저축 15% / 비상금 15% / 자유재량 10%
- 가용금액 계산: 실수령액 + 기타수입(INCOME 합계) - 고정비(활성만)
- ddl-auto: update (초기 설정 완료)

## 계산 로직 (DashboardService)
- fixedCostTotal: FixedCostRepository.sumActiveByMemberId() 실시간 조회 — 할부는 이번 달(달력 월)에 결제 있는 것만 합산
  → API는 /fixed-costs/mine — memberId는 @AuthenticationPrincipal, {id} 조회·수정·삭제는 FixedCostService.findOwned() 소유자 확인
  → FixedCostResponseDto.countedThisMonth가 같은 기준, paid/remainingMonths는 오늘 기준 계산(저장 안 함). 기준 바꾸면 둘 다 수정
- extraIncomeTotal: IncomeRepository.sumBySettleMonth() 실시간 조회
- availableAmount: netSalary + extraIncomeTotal - fixedCostTotal
- 분배: living 35% / ISA 25% / pension 15% / emergency 15% / discretionary 10%

## MonthlyBudgetService 저장 규칙
- 저장/수정 시 fixedCostTotal, availableAmount, 5개 분배금액을 FixedCostRepository로 직접 계산
- 프론트에서 해당 값들을 받지 않음 (netSalary, cardGoal, livingCarryover만 입력받음)

## DashboardService 계산 규칙
- getSummary(): 고정비 실시간 조회 (fixedCostRepository) — 현재 달 대시보드용
- getMonthlyReport() / getEmergencyHistory(): budget.getFixedCostTotal() 사용 — 저장 시점 스냅샷 기준
  → 과거 달 고정비가 바뀌어도 당시 계산값 유지
- emergencyCumulative: EmergencyPage에서 sequential 계산이 단일 소스
  → MonthlyBudget.emergencyCumulative 필드는 사용하지 않음 (프론트에서 전송 안 함)

## MemberService 규칙
- create(): BCrypt 인코딩, salaryDay 기본값 25, role은 항상 USER
  → 입력 검증(2026-11-03, 프론트 SignupPage와 같은 규칙): 아이디 trim+소문자 `^[a-z0-9_]{4,20}$`, 비밀번호 영문+숫자 8~64자, 이름 1~30자, 월급일 1~31 — 테스트 MemberSignupTest
- update(): null 필드는 기존 값 유지 (부분 업데이트 안전) — 프론트에서 salaryDay만 보낼 수 있음
- 로그인 응답(AuthDto.LoginResponse): token, memberId, name, salaryDay 포함
- 로그인 후 프론트 localStorage: token, memberId, memberName, salaryDay 저장

## 회원 탈퇴 (2026-11-03 — 30일 유예 후 파기)
- DELETE /members/{id} = member.deletedAt 기록만 (MemberService.withdraw). 데이터는 그대로, data = 삭제 예정 시각
  → JwtAuthenticationFilter가 탈퇴 회원 토큰을 인증 안 함(401). 로그인은 비밀번호 확인 **후** 409 {code: WITHDRAWN, purgeAt}, body restore:true면 복구 후 로그인
  → CustomUserDetails.isEnabled()로 막지 말 것 — DaoAuthenticationProvider가 비밀번호 확인 전에 걸러 탈퇴 여부가 드러나고 복구도 못 함
- MemberPurgeJob(매일 04:30 KST, @EnableScheduling) → deletedAt 30일 지난 회원마다 MemberPurgeService.purge (회원별 트랜잭션)
  → JdbcTemplate DELETE: CHILD_TABLES(member_id 없는 자식, FK 순서) 먼저 → MEMBER_TABLES → member
  → **새 회원 데이터 테이블을 만들면 MemberPurgeService 목록에 추가** — MemberPurgeServiceTest가 엔티티 스캔으로 누락을 잡음
  → 업로드 이미지 파일(R2·로컬)은 아직 안 지움 — DB 행만 삭제
- 탈퇴 유예 중에도 username은 사용 중 (같은 아이디로 재가입 불가)

## IDOR 회원 범위 규칙 (2026-10-29)
- daily_expense엔 member 컬럼이 없음 → 소유자 = monthlyBudget.member. 월 기준 쿼리는 `e.monthlyBudget.member.id = :memberId` 필수
  → settleMonth는 회원 간 유니크가 아님 — memberId 빠지면 같은 달 다른 회원 지출이 합산·노출됨 (실제 재현됐던 버그)
- DailyExpense/Income/Habit: {id} 조회·수정·삭제는 서비스 findOwned(memberId, id) — 다른 회원이면 not-found와 같은 메시지
  → 지출 등록·예산별 목록은 findOwnedBudget으로 monthlyBudgetId 소유 확인, 수입 등록은 body memberId 무시하고 로그인 회원
- running_record/running_goal: member_id 추가 (이관 docs/migrations/2026-10-29_running_member_scope.sql), unique(member_id, year, month)
- 테스트: LedgerOwnershipGuardTest / OwnershipGuardTest / PlannerOwnershipGuardTest
- 남은 것: category는 전 회원 공용 (루트 CLAUDE.md 다음 작업 후보)

## 투자 납입·전략 (2026-10-29)
- invest_account.monthly_amount = 매달 이 계좌 납입금 (null이면 예전 방식 월 투자금 × targetPct) — InvestAccount.contribution(budget)
  → 대시보드 plannedAmt·DashboardAccount.contribution·DashboardResponse.monthlyBudget(= 계좌 납입금 합계)이 모두 이 값 기준
- invest_account.active(Boolean, null=사용) — 꺼진 계좌는 contribution()=0, rebalanceNeeded=false. 평가금액은 합계에 그대로. AccountRequest.active null이면 기존 값 유지
  → 단독 변경 PATCH /api/invest/accounts/{id}/active {active} — 소유자 아니면 not-found와 같은 메시지
- invest_account.purpose(RETIRE/HOUSE/WEDDING/OTHER) / target_date('YYYY-MM') — null = 미정, 서버에서 형식 검증
- invest_setting.allow_sell(null=true) / strategy_preset(LIQUIDITY/TAX/EQUAL/CUSTOM) — updateStrategy는 null이면 기존 값 유지
- invest_setting.rebalance_mode(2026-11-03): 목표 비중 맞추기 켜짐/꺼짐(기록 모드). null = 안 고름 → InvestService.rebalanceMode가 테마 있거나 strategy_preset 있으면 켜짐+고른 걸로(기존 사용자 그대로), 아니면 꺼짐+미선택
  → SettingResponse·DashboardResponse의 rebalanceMode / rebalanceModeChosen, 변경은 PUT /invest/setting/rebalance-mode {enabled}
- invest_setting.rebalance_style / profit_take_pct(2026-11-04): 테마 안 종목 고르기 — null·THEME = 금액 작은 종목부터, VALUE = 손해 큰 종목 우선 + 수익 profit_take_pct% 넘으면 수익만 매도(null = 5, 0 = 안 팖)
  → 계산은 프론트 utils/themeRebalance.ts. 서버는 저장·DashboardResponse(rebalanceStyle, profitTakePct 기본값 채움)만, 변경은 PUT /invest/setting/rebalance-style {style, profitTakePct}
- GET /invest/accounts 의 linkedBudgetLabel = 최신 정산월 예산에서 그 계좌에 연결된 항목명 (InvestService.budgetLinkedLabels)
- budget_allocation_item.invest_account_id: 예산 항목 ↔ 투자 계좌. **최신 정산월 예산** 저장 때만 그 금액을 계좌 monthly_amount로 동기화 (syncInvestContributions)

## 플래너 관련 규칙
- 플래너 4개 테이블(daily_plan/todo_item/time_box_slot/time_box_block)은 회원별 — 모든 조회·upsert는 로그인 memberId 조건 포함
  → date 기준 upsert(플랜, 슬롯)도 findByMemberIdAnd... 로 찾음 (memberId 빼면 다른 회원 같은 날짜 행을 덮어씀)
  → todo/block의 PUT·DELETE {id}는 서비스 findOwned()에서 소유자 다르면 not-found와 같은 메시지로 IllegalArgumentException
  → 2026-10-28 기존 행 이관: backend/Dailo/docs/migrations/2026-10-28_planner_member_scope.sql (구 unique(plan_date), unique(plan_date,hour) 삭제 포함)
- DailyPlanService가 TodoItemRepository도 의존 (findMonthlyBoard에서 같이 조회)
- findMonthlyBoard: 3번의 쿼리(dailyPlan + big3 + brainDump)로 월간 요약 반환
  → 데이터 없는 날은 응답에 포함 안 됨 (프론트에서 map으로 빈 날은 entry=undefined 처리)
- TodoItem.isDone: Boolean 박싱 타입 → filter 시 Boolean.TRUE.equals() 사용 (NPE 방지)
- /api/daily-plans/board: month 파라미터 1~12 범위 검증 필수 (DateTimeException 방지)
- SpaController + SecurityConfig에 새 SPA 라우트 추가 시 둘 다 수정해야 함
- TodoItem.sortOrder: PUT /api/todo-items/{id}에서 sortOrder 업데이트 지원 (Big3 드래그 재정렬용)
  → UpdateRequest에 sortOrder 필드 포함, item.updateSortOrder() 메서드로 갱신

## 이미지 업로드 규칙 (ImageStorageService → R2 또는 로컬)
- 업로드는 항상 `ImageStorageService.store(folder, file)` 경유 — 검증(빈 파일·10MB·형식) 후 저장소 선택
  → R2 설정이 있으면 R2, 없으면 `LocalImageStorage`(서버 컴퓨터 `upload.local-dir`, 기본 `~/dailo-uploads`)
  → 로컬 파일은 `UploadResourceConfig`가 `/uploads/**`로 서빙(인증 없음 — <img>는 JWT 못 보냄, 파일명 UUID)
- 형식은 파일 앞부분 매직 넘버로 판정(JPG/PNG/GIF/WEBP) — 파일명·Content-Type은 조작 가능하므로 믿지 않음, 확장자도 판정 결과로 붙임
- R2: @Value 빈 기본값(:) 필수(설정 없어도 앱 기동), `isSet()`은 빈 값과 `YOUR_` 예시 값을 미설정으로 취급
  → 예시 값을 설정된 것으로 보면 가짜 엔드포인트로 업로드하다 실패함 (2026-10 실제 발생)
- 런칭 시: application.yml r2.* 에 실제 키만 넣으면 R2로 전환. 기존 /uploads/ 이미지는 옮겨야 함

## VisionBoard 규칙 (미래 시각화 보드, 2026-10)
- `vision_board_item` (memberId, imageUrl, x, y, w, h, z) — 회원별 보드 하나, 날짜 무관. ddl-auto update로 테이블 생성
- x/y/w/h는 보드 대비 퍼센트(0~100) — `VisionBoardService.apply()`가 보드 밖·최소 크기(5%) 보정, null 필드는 기존 값 유지
- imageUrl은 `/uploads/` 또는 `https://`만 허용, 회원당 20장. 수정·삭제는 findOwned로 소유자 확인(IDOR)
- 사진 삭제 시 저장소 파일은 지우지 않음(R2/로컬 모두) — 고아 파일 정리가 필요하면 별도 작업

## TimeBoxBlock 규칙
- TIME_BOX_SLOT과 TIME_BOX_BLOCK은 별개 — SLOT은 시간별 텍스트 2칸, BLOCK은 드래그 병합 블록
- startSlot/endSlot: 0 = 정시(:00), 1 = 30분(:30)
- slotToIndex(hour, slot) = (hour - 5) * 2 + slot — 선형 인덱스 비교에 사용
- block.update(content, isDone) 메서드로 필드 갱신 (setter 직접 호출 금지)

## HabitTracker 규칙
- 습관 삭제 시 habitLogRepository.deleteByHabitId() 먼저 호출 후 habit 삭제 (cascade 수동 처리)
- toggleLog: findByHabitIdAndLogDate로 존재 여부 확인 → 있으면 delete, 없으면 insert
- HABIT_LOG 유니크 제약: (habit_id, log_date) — 중복 체크 불필요 (toggle 로직으로 보장)
- HabitLogRepository.deleteByHabitId(): 호출 메서드에 @Transactional 필요 (HabitService.delete에 있음)
- 프론트 낙관적 업데이트: 클릭 즉시 UI 반영 후 API 호출, 실패 시 fetchLogs로 롤백

## InvestService 규칙
- 설정(InvestSetting): memberId당 1행 — 없으면 기본값(budget=0, threshold=5%, pensionLimit=600만) 반환
- rebalanceThreshold: 종목 현재비중과 목표비중 차이가 이 값(%) 초과 시 rebalanceNeeded=true 반환
  → 목표비중(overallTargetPct) = 계좌targetPct × 종목targetPct / 100
  → 현재비중(currentPct)은 사용자가 PUT /api/invest/records/{id}로 직접 입력
- getDashboard(): 해당 월 레코드가 없으면 자동 생성 (plannedAmt 자동 계산, actualAmt=0)
  → monthlyBudget 변경 시 다음 getDashboard 호출 때 plannedAmt 자동 재계산
  → N+1 방지: holding 전체를 findByAccountIdInOrderBySortOrderAsc()로 한 번에 조회 후 Map 그룹핑
- pensionYtdActual: sumPensionYtdActual() 집계 쿼리로 DB에서 직접 합산 (PENSION 타입 계좌만)
- 계좌/종목 saveAccounts(): 요청에 없는 기존 계좌·종목은 삭제 (관련 레코드도 cascade 삭제)
- InvestDiary: 같은 날짜(memberId+date) 중복 저장 시 덮어씀 (upsert 방식)
- updateRecord(): isPaid 토글 시 currentPct를 null로 보내면 안 됨 → 기존 값 유지해서 전송
- InvestMonthlyRecord.evalAmt: 종목별 평가금액 (nullable) — updateActual()에 4번째 파라미터로 포함
  → 프론트에서 evalAmt - actualAmt = 이번 달 손익 표시
  → InvestMonthlyRecord.yearMonth 컬럼: @Column(name = "`year_month`") 백틱 필수 (MariaDB 예약어)
  → invest_monthly_record 테이블은 ddl-auto:update가 자동 생성 안 함 → 최초 실행 시 수동 CREATE TABLE 필요
- 투자 탭 구조: 투자 현황(납입입력+평가금액 통합) / 투자일기 / 투자 설정 — 납입기록 탭 제거됨
  → /invest/records 접근 시 /invest로 리다이렉트 (SpaController·SecurityConfig에 경로 유지 필요)

## 실시간 시세 (KisClient / QuoteService / InvestQuoteController)
- 구조: KIS WebSocket(H0STCNT0 체결가) → KisClient(앱 전체 연결 1개) → QuoteService 캐시 → SSE `/api/invest/quotes/stream` (회원 본인 종목만)
  → 스냅샷 조회: GET `/api/invest/quotes` / SSE 이벤트: snapshot · quote · status + 25초 하트비트 주석
- 키: 환경변수 `KIS_APP_KEY` / `KIS_APP_SECRET` (모의투자 키면 `KIS_MOCK=true`) — application.yml에 넣지 말 것(커밋 금지 파일)
  → 키 없으면 연결 시도 안 함, status.configured=false → 프론트는 수동 현재가로 동작
- **조회 전용** — 주문 API는 붙이지 않는다
- 종목 매칭: InvestHolding.stockCode (6자리 영숫자, InvestService.normalizeStockCode로 검증). ticker(종목명)는 표시용
- 종목 저장(saveAccounts) 후 InvestHoldingsChangedEvent → AFTER_COMMIT에 구독 종목 재계산
- KIS 제약: 세션당 실시간 등록 약 41건(MAX_SUBSCRIPTIONS=40), 접근토큰 발급 분당 1회(메모리 캐시), PINGPONG은 받은 그대로 돌려보내야 연결 유지
- KIS 키 없으면 네이버 폴링 대체(NaverQuoteClient): `polling.finance.naver.com/api/realtime/domestic/stock/{코드,코드}` — 장중 20초 / 장외 10분, 20종목씩 묶음
  → 비공식 API라 형식 바뀌면 빈 결과(수동 현재가로 복귀). `quote.naver.enabled=false`로 끔. source="NAVER", Status.provider = KIS / NAVER / NONE
  → pollNaver는 RuntimeException까지 잡아야 함 — scheduleWithFixedDelay는 예외 한 번에 이후 실행이 멈춤
- 웹소켓 상태는 KisClient의 단일 스레드 scheduler에서만 변경 (리스너 콜백은 scheduler로 넘겨서 처리)
- 실시간 가격은 DB에 저장하지 않음 (InvestMonthlyRecord.currentPrice는 수동 입력값 그대로)
- SSE 전송 IOException(브라우저가 끊음)이면 구독자만 제거하고 emitter.complete() 호출 금지 — 끊긴 연결에 complete()하면 AsyncRequestNotUsableException이 '서버 오류' ERROR로 찍힘
  → GlobalExceptionHandler가 AsyncRequestNotUsableException은 debug 로그만 (응답 못 씀)

## RunningRecord 규칙
- duration 입력: 프론트에서 "MM:SS" 문자열로 받아 durationSeconds(int)로 저장
- 페이스: RecordResponse.calcPace() — durationSeconds / distanceKm → "7'05''" 형식
- 경로: routeJson 필드에 JSON 문자열로 저장 (LatLng 배열)
- 주간/연간 조회: findByRunDateBetweenOrderByRunDateAsc() 사용

## 배포 (외부 접근)
- CORS: setAllowedOriginPatterns 사용 — setAllowedOrigins와 allowCredentials 동시 사용 불가
  허용 패턴: http://localhost:3000, https://*.trycloudflare.com, https://*.ts.net (Tailscale serve 고정 주소)
  → 새 접속 주소를 쓰면 여기 추가 필요 — 빠지면 브라우저 POST가 "Invalid CORS request" 403 (같은 origin이어도 Origin 헤더 검사함)
- SSE 등 비동기 응답: `dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()` 필수 — JWT 필터가 ASYNC 디스패치에서 안 돌아 스트림이 403으로 끊김
- SpaController: React Router 경로(/expenses, /fixed-costs 등)를 index.html로 포워딩
- Spring Boot 재시작은 수동으로 별도 진행

## 과거 실수 기록
- 회원 삭제가 cash_asset만 지우고 나머지 회원 데이터 테이블 23개를 고아로 남겼음 (2026-11-03) → 30일 유예 + MemberPurgeService 일괄 파기로 교체
- 가입(POST /members)·회원 수정 body의 role을 그대로 저장해 누구나 ADMIN이 될 수 있었음 (2026-11-02) → 항상 USER, 수정은 기존 role 유지. 관리자는 DB에서만
  → CustomUserDetails.admin(role=ADMIN) — 카테고리 생성·수정·삭제는 admin만 (AccessDeniedException → 403, GlobalExceptionHandler)
- MonthlyBudget.livingCarryover·cardGoal null이면 대시보드 summary 500(언박싱) → 생성 시 0 기본값 + 조회 null 가드
- 적금 삭제·월 납입액 변경 전 CashAccountService.snapshot(memberId) 필수 — 지난 납입·만기 수령이 계산에서 사라져 현금 잔액이 되살아나거나 줄어듦
  → snapshot = 지금 계산 잔액으로 모든 계좌 기준 다시 잡기 + 지난 달 말 잔액 cash_asset 저장 (SavingsService.update/delete, MonthlyBudgetService.syncInvestContributions)
- 지출 수정이 정산월·예산을 안 바꿨음(DailyExpense.update에 없음) → 날짜를 고쳐도 옛 정산월 합계에 남음 (2026-11-02 수정)
  → DailyExpenseService.resolveBudget: 요청 settleMonth의 '내' 예산으로 생성·수정 모두 맞춤, 예산 없으면 400. monthlyBudgetId는 settleMonth 없을 때만
- 대시보드·예산 분배 고정비가 오늘 기준(sumActiveByMemberId)이라 할부가 끝나면 지난 달 가용금액이 바뀜 → FixedCostRepository.sumForSettleMonth(그 정산월) 사용
- sumCardExpense 쿼리 오타 → sumEmergncyExpense로 적었다 수정함
- ApiResponse.success() 없음 → ApiResponse.ok() 사용해야 함
- DailyExpenseResponseDto: category 객체 없이 categoryName(String)만 반환함
  → 프론트에서 item.category?.name 대신 item.categoryName 사용해야 함
- MonthlyBudgetService: 저장 시 프론트값 그대로 쓰면 고정비 변경 시 stale 발생
  → calcDistribution()으로 서버에서 직접 계산하도록 수정함
- getMonthlyReport/getEmergencyHistory에서 fixedCostRepository.sumActiveByMemberId() 사용 시
  현재 고정비로 과거 달을 재계산하는 문제 → budget.getFixedCostTotal() 스냅샷으로 수정함
- SecurityConfig에서 /api/**만 permitAll 시 정적 파일(/, /static/**, /*.js 등) 403 발생
  → 정적 파일 경로 및 SPA 라우트 경로도 permitAll에 추가
- SPA 라우트(/expenses 등) 직접 접근 시 Spring Boot가 파일로 인식해 다운로드 시도
  → SpaController 추가해서 index.html로 포워딩
- CORS 외부 저장 실패(403 invalid CORS request): setAllowedOrigins → setAllowedOriginPatterns로 변경
- TodoItem::getIsDone filter 시 메서드 레퍼런스 사용 시 NPE 가능 → Boolean.TRUE.equals() 사용
- MariaDB에서 `password`, `year_month`(YEAR 포함) 등 예약어 컬럼명 → Hibernate 엔티티에서 @Column(name = "`year_month`") 백틱 처리 필수
  → SQL DDL 직접 작성 시에도 백틱 필수
  → invest_monthly_record 테이블은 ddl-auto가 자동 생성 안 함 → 수동 CREATE TABLE 실행 필요했음
- MemberService.update()에서 null 필드를 그대로 쓰면 부분 업데이트 시 기존 값 덮어씀
  → null이면 기존 member 값 유지하도록 수정
- application.yml YAML 들여쓰기 깨짐(spring.jpa.properties 하위 hibernate가 최상위로 밀림) → 앱 시작 실패
  → 부팅 실패 시 Spring property binding 에러면 application.yml 들여쓰기부터 확인
- `mvn` 명령이 PATH에 없음 → `./mvnw` 사용 (IntelliJ는 Bundled Maven이라 무관)- id로 수정·삭제하는 API에서 회원 소유권 미확인(IDOR) — `PUT /invest/records/{id}`, `DELETE /invest/diary/{id}`, `DELETE /workouts/logs/{id}`, `POST /workouts/logs`의 세트 id
  → 2026-10-27 수정: 컨트롤러에서 `@AuthenticationPrincipal`로 memberId를 받고, 서비스에서 소유자가 다르면 not-found와 같은 메시지로 IllegalArgumentException(400)
  → 자식 엔티티는 부모 경로로 검증 (record → holding → account.memberId / set → workoutLog가 지금 저장 중인 로그인지)
  → 새 `{id}` 엔드포인트 추가 시 반드시 소유권 검증 + `OwnershipGuardTest`에 케이스 추가 (플래너는 `PlannerOwnershipGuardTest`)
- 플래너(daily-plans/todo-items/time-box/time-box-blocks)에 memberId가 아예 없어 모든 계정이 같은 플랜을 공유·수정 (2026-10-28 수정)
  → ddl-auto update는 NOT NULL 컬럼을 0으로 채우고 기존 unique 인덱스를 지우지 않음 → 컬럼 추가 마이그레이션은 SQL로 먼저 실행
  → `./mvnw test`의 contextLoads는 실제 DB(3333)에 붙음 — 엔티티 스키마 변경 후 마이그레이션 전이면 `-Dspring.jpa.hibernate.ddl-auto=none`으로 실행
- WorkoutSet.setType (NORMAL/WARMUP/DROP/FAILURE, nullable — 기존 로우 null은 응답에서 NORMAL) — ddl-auto update로 컬럼 자동 추가, 허용값 외는 서비스에서 NORMAL로 정규화
- 운동 종목 즐겨찾기: `workout_bookmark`(member_id, exercise_name 유니크) — 종목 마스터 테이블이 없어 종목명 문자열로 저장
  → 종목명에 공백·한글이 있어 path variable 대신 POST body / DELETE query param 사용, 항상 로그인 memberId로만 조회·삭제

## 투자 체결 기록 (InvestTradeService / invest_trade)
- POST `/api/invest/holdings/{holdingId}/trades` {side: BUY|SELL, shares, price, tradeDate?} → 보유 수량·평균단가 갱신
  → 매수: 평균단가 = (기존 평균×기존 수량 + 체결가×수량) / 새 수량 (반올림), 매도: 수량만 감소(보유보다 많이 팔면 400)
  → 이번 달 기록에 수동 현재가가 있으면 평가금액도 새 수량으로 재계산
- GET `/api/invest/trades?yearMonth=YYYY-MM`, DELETE `/api/invest/trades/{id}` (되돌리기 — 종목별 가장 최근 체결만, sharesBefore/avgBefore로 복원)
- invest_trade는 holding FK 없이 id·이름 스냅샷 저장 (종목 삭제돼도 기록 유지). 모든 조회·수정은 memberId 소유 확인
- saveAccounts: 계좌/종목 id 소유 확인 추가(IDOR 수정), 한 계좌에 같은 종목코드 두 줄이면 400

## 테마 · 자산 배분 (AllocationService / invest_theme / asset_bucket)
- GET/POST `/api/invest/themes` — 목록 통째로 저장(요청에 없는 테마 삭제 → 소속 종목 themeId null), 합계 100 검증, id 소유 확인
- GET/POST `/api/assets/buckets` — 처음 GET 시 현금(CASH)·투자(INVEST)·부동산·적금(MANUAL) 25%씩 생성, kind는 CASH/INVEST/MANUAL
- InvestHolding.themeId(FK 아님) / manualValue(현금성 금액) — saveAccounts에서 assign(), themeId는 본인 테마만(아니면 400)
- DashboardResponse.themes 포함. 리밸런싱 계산은 프론트(utils/themeRebalance.ts)

## 적금 (SavingsService / savings)
- GET/POST `/api/savings`, PUT/DELETE `/api/savings/{id}` — 소유 확인, 기간 1~120개월, 이율 0~30%, paidOverride 0~기간
- 회차·원금·만기 수령액은 저장하지 않음(프론트 utils/savings.ts 계산). AssetBucket kind에 SAVINGS 추가
  → getBuckets: 예전 기본값으로 만든 '적금'(MANUAL, 금액 없음) 칸은 SAVINGS로 자동 전환


## 현금 계좌·예산 연결 확대 (2026-10-29)
- cash_account(member_id, name, bank, balance BIGINT, active, sort_order, memo) — CashAccountService가 변경마다 syncMonth(memberId, settleMonth)
  → cash_asset(그 달) balance = 켜진 계좌 합계, memo·livingSurplusApplied 유지. 계좌 0개면 cash_asset 안 건드림
  → 정산월은 프론트 salaryDay(localStorage) 기준이라 서버가 계산 못 함 — 변경 API는 ?settleMonth 필수, 형식 틀리면 400
- budget_allocation_item.savings_id — investAccountId와 동시 지정 400, 본인 적금만. 최신 달 저장 시 Savings.updateMonthlyAmount

## 현금 잔액 자동 반영 (2026-11-02)
- 잔액은 저장하지 않고 읽을 때 계산: CashBalanceService(데이터 로드) → CashFlow.calculate(순수 계산, 테스트 CashFlowTest)
  → 계좌 잔액 = 기준 잔액(cash_account.balance, balance_as_of, balance_month) + 그 뒤 기록. 지출을 고치거나 지워도 되돌릴 게 없음
  → 현금·이체 지출/수입: 날짜 > 기준일이면 반영(기준일 당일은 createdAt > balanceAsOf). 카드: 정산월이 끝날 때 한 번에(기준 달 이상만, 진행 중 달은 pendingCard)
  → 월급(그 달 MonthlyBudget.netSalary) − 고정비(sumActiveByMemberIdForMonth): 기준 달 **다음 달부터**, 기본 계좌(켜진 계좌 첫 번째)에만
  → daily_expense/income.cash_account_id null·지운 계좌 = 기본 계좌. 남의 계좌 id는 서비스에서 400
- GET /cash-assets·/cash-accounts 는 ?settleMonth(현재 정산월) 받음 — 켜진 계좌 모두 기준이 있는 달(max balance_month)부터 그 달까지 계산값(auto=true)으로 덮어씀, 그 전 달은 저장값
- PUT /cash-accounts/{id}: 보낸 balance ≠ 현재 계산 잔액이면 '잔액 맞추기'(anchor = now, settleMonth). 이름만 고치면 기준 유지 — 화면이 계산값을 보내기 때문
  → 적금·청약 납입(2026-11-02): CashFlow.savingsPayments — startDate.plusMonths(n)(말일 보정) 날마다 −monthlyAmount, 기본 계좌. 적금은 months회, 청약(HOUSING)은 만기 없음
    정산월은 Member.salaryDay(기본 25)로 settleMonthOf — 프론트 getSettleMonthForDate와 같은 규칙. paidOverride·만기 수령액은 현금에 반영 안 함
    → 납입 기록(2026-11-02): daily_expense.savings_id(본인 적금만, DailyExpenseService.ownedSavings). 그 지출의 settleMonth = 납입일 정산월이면 그 회차 자동 납입은 안 만듦(savingsPayments recorded) — 지출이 대신 빠짐, 금액 달라도 지출 금액
    → GET /savings 응답 records(지출 id·날짜·정산월·금액) — 프론트 recentRounds가 회차별 기록됨/기록 없음 표시. 적금 삭제해도 지출의 savings_id는 남음(무시됨)
  → 적금 만기(2026-11-02): CashFlow.maturityPayout — 만기일(start.plusMonths(months))에 세후 수령액(프론트 savingsSummary.maturityAmount와 같은 식) +, 기본 계좌. 청약 없음
    → 프론트 currentPrincipal·적금 합계는 MATURED를 0으로 (자산 현황 두 번 세기 방지)
- 옛 계좌(balance_as_of null)는 updatedAt·최근 cash_asset 달을 기준으로 씀

## 생활비 예산·메모 (2026-10-29)
- DashboardService.getSummary/getMonthlyReport: 생활비·비상금 예산 = 같은 이름 분배 항목 금액(labeledAmount), 없으면 레거시 비율
  → 2026-09부터 레거시 rate가 0이라 livingBalance가 '-지출'로 나왔음 (현금 자산 잉여금 반영까지 틀림). 분배 항목 금액 계산은 liveItems 한 곳
  → MonthlyReportDto.allocationItems 추가 (IN절 한 번 조회 후 그룹핑)
- 레거시 고정 5칸 rate는 프론트가 더 이상 안 보냄 — 생성 0 / 수정 시 기존 값 유지. 컬럼 삭제는 옛 달 스냅샷 때문에 보류
- member_note(member_id, note_key, content TEXT) — 키는 (budget|planner)-YYYY-MM만, 5000자, 빈 내용이면 삭제

- InvestTheme.satellite(2026-11-02, nullable — 옛 행 null=false): 위성 테마 = targetPct가 상한. 저장 시 cash=true면 satellite 강제 false. ThemeDto에 satellite 필드
