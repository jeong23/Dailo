# 가계부 대시보드 웹앱 - 요구사항 정의서

> Tech Stack: Spring Boot 3.x + React + TypeScript + MariaDB  
> 작성일: 2026년 4월 | 버전: 1.0

---

## 1. 프로젝트 개요

### 1.1 프로젝트명
Budget Dashboard (가계부 대시보드)

### 1.2 목적
월급 기반 예산 분배 및 일일 지출을 관리하는 개인용 웹 대시보드.  
예산 현황, 지출 패턴, 카드 실적을 시각화하여 한눈에 파악한다.

### 1.3 핵심 변경사항
- 노션 API 연동 → 자체 백엔드 (Spring Boot 3.x + JPA + MariaDB)
- 노션 Formula/Rollup → Service 레이어 비즈니스 로직 + JPQL 집계 쿼리
- 노션 Select 타입 → 별도 CATEGORY 테이블 + FIXED_COST 테이블
- 회원/인증 추가 (Spring Security + JWT)
- 포트폴리오용 현업 동일 구조 (Controller-Service-Repository 패턴)

### 1.4 확장 계획
- Phase 1: 가계부 대시보드 (MVP)
- Phase 2: Todo 기능 추가
- Phase 3: 공부 기록 기능 추가

---

## 2. 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| 백엔드 | Spring Boot 3.x + Java 17 | 현업 동일 스택, 포트폴리오 활용 |
| ORM | Spring Data JPA + Hibernate | 현업에서 사용 중인 JPA 심화 학습 |
| DB | MariaDB 10.x | 현업 동일 DB, DBeaver로 관리 |
| 인증 | Spring Security + JWT | 현업 Spring Security 경험 활용 |
| 프론트엔드 | React 18 + TypeScript | 포트폴리오 차별화 (JSP와 다른 기술) |
| 차트 | Recharts | React 생태계 최적화, 선언적 API |
| 스타일링 | Tailwind CSS | 빠른 UI 개발, 반응형 용이 |
| 빌드 | Maven | 현업 동일 빌드 도구 |
| 배포 | Vercel (프론트) + 별도 서버 (백엔드) | 프론트/백엔드 분리 배포 |
| 버전관리 | Git + GitHub | 현업 SourceTree 경험 + GitHub TIL |

---

## 3. 데이터베이스 설계

### 3.1 MEMBER (회원)
인증/인가 및 모든 데이터의 소유자. 추후 Todo/공부기록도 연결.

| 컬럼명 | 타입 | PK/FK | 설명 |
|--------|------|-------|------|
| id | BIGINT | PK | AUTO_INCREMENT |
| username | VARCHAR(50) | UK | 로그인 ID |
| password | VARCHAR(255) | | BCrypt 암호화 |
| name | VARCHAR(30) | | 사용자 이름 |
| role | VARCHAR(20) | | ROLE_USER / ROLE_ADMIN |
| salary_gross | INT | | 세전 급여 (참고용) |
| created_at | DATETIME | | 가입일 |
| updated_at | DATETIME | | 수정일 |

### 3.2 MONTHLY_BUDGET (월별 예산)
매월 1행씩 추가. 분배 금액은 Service에서 계산 후 저장.

| 컬럼명 | 타입 | PK/FK | 설명 |
|--------|------|-------|------|
| id | BIGINT | PK | AUTO_INCREMENT |
| member_id | BIGINT | FK | MEMBER.id |
| settle_month | VARCHAR(7) | | 정산월 (2026-04) |
| net_salary | INT | | 실수령액 |
| fixed_cost_total | INT | | 고정비 합계 (스냅샷) |
| available_amount | INT | | 가용 금액 = 실수령 - 고정비 |
| living_budget | INT | | 생활비 예산 (35%) |
| isa_amount | INT | | ISA 금액 (25%) |
| pension_amount | INT | | 연금저축 (15%) |
| emergency_budget | INT | | 비상금 예산 (15%) |
| discretionary_budget | INT | | 자유재량 (10%) |
| card_goal | INT | | 카드 실적 목표 |
| living_carryover | INT | | 전월 생활비 이월액 |
| emergency_cumulative | INT | | 비상금 누적액 |
| created_at | DATETIME | | 생성일 |

### 3.3 DAILY_EXPENSE (일일 지출)
Formula 필드는 DB에 두지 않고 JPQL WHERE 조건으로 처리.

| 컬럼명 | 타입 | PK/FK | 설명 |
|--------|------|-------|------|
| id | BIGINT | PK | AUTO_INCREMENT |
| monthly_budget_id | BIGINT | FK | MONTHLY_BUDGET.id |
| category_id | BIGINT | FK | CATEGORY.id |
| item_name | VARCHAR(100) | | 지출처 (이마트, 주유소 등) |
| amount | INT | | 지출 금액 |
| expense_date | DATE | | 지출 날짜 |
| settle_month | VARCHAR(7) | | 정산월 (25일 기준 자동 계산) |
| payment_method | VARCHAR(10) | | 카드 / 현금 / 이체 |
| budget_type | VARCHAR(10) | | 생활비 / 비상금 |
| memo | VARCHAR(255) | | 메모 (선택) |
| created_at | DATETIME | | 생성일 |

### 3.4 CATEGORY (카테고리)
노션 Select 타입을 별도 테이블로 분리. 카테고리 추가/수정 자유로움.

| 컬럼명 | 타입 | PK/FK | 설명 |
|--------|------|-------|------|
| id | BIGINT | PK | AUTO_INCREMENT |
| name | VARCHAR(30) | UK | 카테고리명 (식비, 교통 등) |
| icon | VARCHAR(10) | | 이모지/아이콘 |
| sort_order | INT | | 표시 순서 |

### 3.5 FIXED_COST (고정비)
노션에서 컬럼으로 박혀있던 고정비 항목을 별도 테이블로 분리.

| 컬럼명 | 타입 | PK/FK | 설명 |
|--------|------|-------|------|
| id | BIGINT | PK | AUTO_INCREMENT |
| member_id | BIGINT | FK | MEMBER.id |
| name | VARCHAR(50) | | 항목명 (보험_삼성, 통신비 등) |
| amount | INT | | 금액 |
| is_active | BOOLEAN | | 활성 여부 (false=해지) |
| sort_order | INT | | 표시 순서 |
| created_at | DATETIME | | 생성일 |

---

## 4. 비즈니스 규칙

### 4.1 월급 분배 비율
고정비 차감 후 가용 금액 기준:

| 항목 | 비율 | 계산식 |
|------|------|--------|
| 생활비 | 35% | available_amount × 0.35 |
| ISA (중기 투자) | 25% | available_amount × 0.25 |
| 연금저축 (세액공제) | 15% | available_amount × 0.15 |
| 비상금 | 15% | available_amount × 0.15 |
| 자유재량 | 10% | available_amount × 0.10 |

### 4.2 정산월 기준
- 월급일: 매월 25일
- 정산 기간: 전월 25일 ~ 당월 24일
- 예: 2026-04 정산월 = 2026년 3월 25일 ~ 2026년 4월 24일
- 구현: DailyExpenseService에서 expense_date 기준으로 settle_month 자동 계산

### 4.3 계산 전략 (노션 Formula → Spring Boot)

| 노션 (AS-IS) | Spring Boot (TO-BE) | 구현 위치 |
|-------------|---------------------|-----------|
| 고정비 합계 (Formula) | SUM(fixed_costs WHERE is_active) | FixedCostRepository |
| 가용 금액 (Formula) | net_salary - fixed_cost_total | BudgetService |
| 분배 금액 (Formula) | available × 비율 | BudgetService |
| 생활비 지출합계 (Rollup) | SUM WHERE budget_type='생활비' | ExpenseRepository (JPQL) |
| 카드 지출합계 (Rollup) | SUM WHERE payment_method='카드' | ExpenseRepository (JPQL) |
| 예산 소진율 (Formula) | 지출합계 / budget × 100 | DashboardService |
| 카드 실적 달성률 (Formula) | 카드지출 / card_goal × 100 | DashboardService |
| 생활비 잔액 (Formula) | budget + carryover - 지출합계 | DashboardService |
| 정산월 (Formula) | 25일 기준 자동계산 | ExpenseService |

---

## 5. 기능 요구사항

### 5.1 인증/인가
**F-001:** 회원가입 / 로그인
- JWT 기반 인증 (Access Token + Refresh Token)
- BCrypt 비밀번호 암호화
- 로그인 실패 시 에러 메시지 처리

### 5.2 대시보드 메인

**F-002:** 이번 달 요약 카드
- 실수령액, 고정비, 가용 금액 표시
- 분배 항목별 금액 표시 (생활비, ISA, 연금저축, 비상금, 자유재량)

**F-003:** 생활비 예산 프로그레스바
- 예산 대비 지출 진행률 시각화
- 색상: 0~50% 초록, 50~80% 노랑, 80~100% 빨강

**F-004:** 비상금 현황
- 비상금 예산 + 누적 대비 잔액, 이번 달 비상금 지출 내역

**F-005:** 카드 실적 달성률
- 카드 실적 목표 대비 프로그레스바, 목표 달성 시 완료 표시

**F-006:** 카테고리별 지출 파이차트
- 정산월 기준 카테고리별 지출 비율 시각화

**F-007:** 일별 지출 막대 그래프
- 정산월 기준 날짜별 지출 금액, 호버 시 상세 내역

**F-008:** 최근 지출 내역 리스트
- 최근 10건 표시 (항목, 금액, 카테고리, 결제수단, 날짜)

**F-009:** 지출 등록 (CRUD)
- 대시보드에서 직접 지출 등록/수정/삭제
- 카테고리 선택, 결제수단 선택, 예산구분 선택

**F-010:** 월별 예산 설정
- 실수령액 입력 시 분배 금액 자동 계산 미리보기
- 카드 실적 목표, 이월액 수동 입력

**F-011:** 정산월 필터링
- 드롭다운으로 정산월 선택 가능
- 25일 기준으로 해당 정산월 데이터만 조회

---

## 6. 비기능 요구사항

### 6.1 반응형 디자인
- 모바일 우선 설계 (Mobile First)
- 모바일, 태블릿, PC 모두 대응

### 6.2 다크 모드
- 기본 다크 테마
- 라이트 모드 토글 선택 가능

### 6.3 성능
- 페이지 로딩 2초 이내
- API 응답 500ms 이내

### 6.4 보안
- JWT 토큰 기반 인증
- CORS 설정 (프론트엔드 도메인만 허용)
- API 엔드포인트 인증 필수 (로그인 제외)

---

## 7. 패키지 구조 (Spring Boot)

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

---

## 8. API 설계 (RESTful)

### 8.1 인증
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/auth/signup | 회원가입 |
| POST | /api/auth/login | 로그인 (JWT 발급) |
| POST | /api/auth/refresh | 토큰 갱신 |

### 8.2 월별 예산
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/budgets?month=2026-04 | 정산월 예산 조회 |
| POST | /api/budgets | 월별 예산 생성 |
| PUT | /api/budgets/{id} | 예산 수정 |

### 8.3 일일 지출
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/expenses?month=2026-04 | 정산월 지출 목록 |
| POST | /api/expenses | 지출 등록 |
| PUT | /api/expenses/{id} | 지출 수정 |
| DELETE | /api/expenses/{id} | 지출 삭제 |

### 8.4 대시보드
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/dashboard/summary?month=2026-04 | 요약 카드 데이터 |
| GET | /api/dashboard/category-stats?month=2026-04 | 카테고리별 지출 통계 |
| GET | /api/dashboard/daily-stats?month=2026-04 | 일별 지출 통계 |

### 8.5 카테고리 / 고정비
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/categories | 카테고리 목록 |
| GET | /api/fixed-costs | 고정비 목록 |
| PUT | /api/fixed-costs/{id} | 고정비 수정/비활성화 |

---

## 9. 참고사항
- 실수령액 참고: 수습 기간 (80%) ₩1,843,680 / 정규 전환 후 ≈₩2,304,600
- ISA / 연금저축 계좌: 미개설 상태 (금액은 계산하되 실제 이체는 추후)
- 데이터 입력: 대시보드에서 직접 CRUD
- 정산월 기준: 25일 (월급일)
- 현업 동일 구조: Controller-Service-Repository 패턴, Spring Security, JPA
