# Budget Dashboard API

## 프로젝트 개요
- Spring Boot 3.4.x + Java 17 + JPA + MariaDB
- 빌드: Maven
- 패키지: com.budget.dashboard
- 포트: 8888
- DB: localhost:3333 / budget_dashboard

## 패키지 구조
```
com.budget.dashboard
├── controller
├── service
├── repository
├── entity
├── dto
├── config
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
- MEMBER (회원)
- MONTHLY_BUDGET (월별 예산)
- DAILY_EXPENSE (일일 지출)
- CATEGORY (카테고리)
- FIXED_COST (고정비)
- INCOME (기타 수입 - 이자, 환급금 등)

## API 엔드포인트 목록
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

## 비즈니스 규칙
- 월급일: 매월 25일
- 정산 기간: 전월 25일 ~ 당월 24일
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
- 프론트에서 해당 값들을 받지 않음 (netSalary, cardGoal, livingCarryover, emergencyCumulative만 입력받음)

## 규칙
- 컴파일/실행은 개발자가 직접 한다 (mvn, bootRun 명령 실행 금지)
- 코드 작성 후 실행 결과는 개발자가 확인 후 피드백한다

## 빌드/실행
- mvn spring-boot:run
- mvn test

## DashboardService 계산 규칙
- getSummary(): 고정비 실시간 조회 (fixedCostRepository) — 현재 달 대시보드용
- getMonthlyReport() / getEmergencyHistory(): budget.getFixedCostTotal() 사용 — 저장 시점 스냅샷 기준
  → 과거 달 고정비가 바뀌어도 당시 계산값 유지
- emergencyCumulative: EmergencyPage에서 sequential 계산이 단일 소스
  → MonthlyBudget.emergencyCumulative 필드는 사용하지 않음 (프론트에서 전송 안 함)

## 과거 실수 기록
- sumCardExpense 쿼리 오타 → sumEmergncyExpense로 적었다 수정함
- ApiResponse.success() 없음 → ApiResponse.ok() 사용해야 함
- DailyExpenseResponseDto: category 객체 없이 categoryName(String)만 반환함
  → 프론트에서 item.category?.name 대신 item.categoryName 사용해야 함
- MonthlyBudgetService: 저장 시 프론트값 그대로 쓰면 고정비 변경 시 stale 발생
  → calcDistribution()으로 서버에서 직접 계산하도록 수정함
- getMonthlyReport/getEmergencyHistory에서 fixedCostRepository.sumActiveByMemberId() 사용 시
  현재 고정비로 과거 달을 재계산하는 문제 → budget.getFixedCostTotal() 스냅샷으로 수정함

## 다음 작업 후보
- [ ] 로그인/인증 (JWT) - 현재 memberId: 1 하드코딩
- [ ] N+1 쿼리 개선 (getMonthlyReport/getEmergencyHistory — 월 수 × 2 쿼리 발생)
