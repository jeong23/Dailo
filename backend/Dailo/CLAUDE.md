# Dailo API

## 프로젝트 개요
- Spring Boot 3.4.x + Java 17 + JPA + MariaDB
- 빌드: Maven
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

## 규칙
- 컴파일/실행은 개발자가 직접 한다 (mvn, bootRun 명령 실행 금지)
- 코드 작성 후 실행 결과는 개발자가 확인 후 피드백한다

## 빌드/실행
- mvn spring-boot:run
- mvn test

## DB 테이블 목록
- MEMBER (회원 — username, password, name, role, salaryGross, salaryDay)
- MONTHLY_BUDGET (월별 예산)
- DAILY_EXPENSE (일일 지출 — settleMonth는 expenseDate 기준 자동 계산)
- CATEGORY (카테고리)
- FIXED_COST (고정비)
- INCOME (기타 수입 - 이자, 환급금 등)
- DAILY_PLAN (일일 플래너 — 미래시각화/정체성/내적동기/감사일기/기상직후할일/피드백)
- TODO_ITEM (할 일 — type: BIG3 | BRAIN_DUMP, isDone, sortOrder)
- TIME_BOX_SLOT (타임박스 — hour(5~23), slot1/slot2 텍스트, slot1Done/slot2Done)
- TIME_BOX_BLOCK (타임박스 블록 — planDate, startHour, startSlot, endHour, endSlot, content, isDone)
- HABIT (습관 — memberId, name, emoji, color, isActive, sortOrder)
- HABIT_LOG (습관 체크 기록 — habit_id, log_date, UNIQUE(habit_id, log_date))

## API 엔드포인트 목록
- POST       /api/auth/login                        ← JWT 로그인 (token, memberId, name, salaryDay 반환)
- GET/POST   /api/members                           ← GET 목록 / POST 회원가입 (permitAll)
- GET/PUT    /api/members/{id}                      ← 조회 / 수정 (authenticated)
- GET/POST   /api/monthly-budgets
- GET        /api/monthly-budgets/member/{memberId}
- GET        /api/monthly-budgets/member/{memberId}/month/{settleMonth}
- PUT/DELETE /api/monthly-budgets/{id}
- GET/POST   /api/daily-expenses
- GET        /api/daily-expenses/month/{settleMonth}
- PUT/DELETE /api/daily-expenses/{id}
- GET/POST   /api/incomes
- GET        /api/incomes/month/{settleMonth}
- PUT/DELETE /api/incomes/{id}
- GET/POST   /api/fixed-costs
- GET        /api/fixed-costs/member/{memberId}
- PUT/DELETE /api/fixed-costs/{id}
- GET        /api/categories
- GET        /api/dashboard/summary?month=YYYY-MM
- GET        /api/dashboard/daily-stats?month=YYYY-MM
- GET        /api/dashboard/category-stats?month=YYYY-MM
- GET        /api/dashboard/monthly-report?memberId={id}
- GET        /api/dashboard/emergency-history?memberId={id}
- GET/POST   /api/daily-plans/{date}
- GET        /api/daily-plans/board?year=YYYY&month=MM
- POST       /api/daily-plans/upload-image
- GET/POST   /api/todo-items?date=YYYY-MM-DD
- PUT/DELETE /api/todo-items/{id}
- GET/POST   /api/time-box?date=YYYY-MM-DD
- GET        /api/time-box-blocks?date=YYYY-MM-DD
- POST       /api/time-box-blocks
- PUT/DELETE /api/time-box-blocks/{id}
- GET        /api/running/records?memberId={id}
- GET        /api/running/records/week?start=YYYY-MM-DD
- GET        /api/running/records/year?year=YYYY
- GET/POST   /api/running/goal?memberId={id}&month=YYYY-MM
- GET        /api/habits
- POST       /api/habits
- PUT/DELETE /api/habits/{id}
- GET        /api/habits/logs?year=YYYY&month=MM
- POST       /api/habits/logs

## 인증 (JWT)
- 방식: Stateless JWT (jjwt 0.12.6), 30일 만료
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
- fixedCostTotal: FixedCostRepository.sumActiveByMemberId() 실시간 조회
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
- create(): BCrypt 인코딩, salaryDay 기본값 25
- update(): null 필드는 기존 값 유지 (부분 업데이트 안전) — 프론트에서 salaryDay만 보낼 수 있음
- 로그인 응답(AuthDto.LoginResponse): token, memberId, name, salaryDay 포함
- 로그인 후 프론트 localStorage: token, memberId, memberName, salaryDay 저장

## 플래너 관련 규칙
- DailyPlanService가 TodoItemRepository도 의존 (findMonthlyBoard에서 같이 조회)
- findMonthlyBoard: 3번의 쿼리(dailyPlan + big3 + brainDump)로 월간 요약 반환
  → 데이터 없는 날은 응답에 포함 안 됨 (프론트에서 map으로 빈 날은 entry=undefined 처리)
- TodoItem.isDone: Boolean 박싱 타입 → filter 시 Boolean.TRUE.equals() 사용 (NPE 방지)
- /api/daily-plans/board: month 파라미터 1~12 범위 검증 필수 (DateTimeException 방지)
- SpaController + SecurityConfig에 새 SPA 라우트 추가 시 둘 다 수정해야 함

## R2 업로드 규칙
- application.yml에 r2.* 설정 없으면 앱 시작 안 됨 방지: @Value에 빈 기본값(:) 필수
- isConfigured 플래그로 설정 여부 체크 — 미설정 시 upload() 호출 시 예외 대신 메시지 반환

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

## RunningRecord 규칙
- duration 입력: 프론트에서 "MM:SS" 문자열로 받아 durationSeconds(int)로 저장
- 페이스: RecordResponse.calcPace() — durationSeconds / distanceKm → "7'05''" 형식
- 경로: routeJson 필드에 JSON 문자열로 저장 (LatLng 배열)
- 주간/연간 조회: findByRunDateBetweenOrderByRunDateAsc() 사용

## 프론트엔드 규칙
- 모든 페이지 모바일/데스크탑 반응형 적용
  → 테이블: 모바일 카드 리스트(md:hidden) + 데스크탑 테이블(hidden md:block)
  → 모달: 모바일 바텀시트(items-end, rounded-t-3xl) + 데스크탑 중앙 팝업(sm:items-center, sm:rounded-3xl)
- format.ts 핵심 함수:
  → getCurrentSettleMonth(): 오늘 날짜 기준 정산월
  → getSettleMonthForDate(dateStr): 특정 날짜 기준 정산월 (지출/수입 저장 시 사용)
  → getMonthOptions(count): 최근 N개월 옵션

## Git 저장소 구조
- `frontend/Dailo` — 별도 Git 저장소 (`.git` 독립)
- `backend/Dailo` — 별도 Git 저장소 (`.git` 독립)
- 프론트 소스 수정만으로는 백엔드 SourceTree에 변경 안 보임
- 빌드 후 `src/main/resources/static/`에 복사해야 백엔드 Git에 반영됨

## 배포 (외부 접근)
- React 빌드 후 `src/main/resources/static/`에 복사해서 Spring Boot에서 서빙
- 외부 접근: Cloudflare Tunnel 사용 (`cloudflared tunnel --url http://localhost:8888`)
- CORS: setAllowedOriginPatterns 사용 — setAllowedOrigins와 allowCredentials 동시 사용 불가
  허용 패턴: http://localhost:3000, https://*.trycloudflare.com
- SpaController: React Router 경로(/expenses, /fixed-costs 등)를 index.html로 포워딩
- 빌드/복사 순서:
  1. `cd frontend/Dailo && npm run build`
  2. `cp -r build/* backend/Dailo/src/main/resources/static/`
  3. Spring Boot 재시작

## 과거 실수 기록
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
- MariaDB에서 `password` 컬럼명이 예약어 → SQL에서 반드시 백틱으로 감싸야 함
- MemberService.update()에서 null 필드를 그대로 쓰면 부분 업데이트 시 기존 값 덮어씀
  → null이면 기존 member 값 유지하도록 수정

## 다음 작업 후보
- [ ] N+1 쿼리 개선 (getMonthlyReport/getEmergencyHistory — 월 수 × 2 쿼리 발생)