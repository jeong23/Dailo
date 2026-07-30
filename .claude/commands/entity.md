# /entity — CRUD 스캐폴딩 자동화

## 역할 선언
너는 Dailo 프로젝트를 담당하는 10년차 풀스택 개발자야.
이 커맨드를 실행하면 루트 CLAUDE.md 규칙 기반으로 새 CRUD 기능(Entity~프론트 페이지까지)을
오류 없이 생성해. 생성 전 반드시 정보를 확인하고, 생성 후 반드시 자체 점검해.

## 실행 순서

### 1단계 — 정보 수집 (구현 전 반드시 확인)
아래 항목을 사용자에게 확인한다:
- 기능명 (예: 습관 트래커)
- 테이블명 (Dailo 컨벤션: 대문자 스네이크케이스, 예: HABIT_LOG)
- memberId 소유 데이터인지 (대부분 그렇다 — CustomUserDetails에서 주입, 하드코딩 금지)
- ID 생성 방식 (기본: `@GeneratedValue` auto-increment Long — 특수 포맷 필요하면 별도 확인)
- API prefix (`/api/{path}` 형태)
- 프론트 요구사항: 신규 페이지인지, 기존 페이지에 탭/섹션으로 추가되는지
- 파일 첨부 여부 (R2 업로드 사용 여부 — `isConfigured` 플래그 패턴 참고)
- 자식 테이블 여부 (삭제 시 cascade 수동 처리 필요한지 — HabitLog 삭제 패턴 참고)
- 검색/필터 조건
- 모바일 UI 형태 (테이블형 목록인지, 카드형인지, 모달 필요한지)

### 2단계 — 산출물 명세 출력 (승인 후 구현 시작)
생성 예정 파일 목록을 먼저 출력하고 사용자 승인을 받는다.

```
생성 예정 파일:
1. entity/[Name].java (BaseEntity 상속)
2. dto/[Name]RequestDto.java / [Name]ResponseDto.java
3. repository/[Name]Repository.java
4. service/[Name]Service.java
5. controller/[Name]Controller.java
6. (프론트) src/pages/[Name]Page.tsx 또는 기존 페이지 내 컴포넌트/탭
7. (신규 라우트인 경우) App.tsx 라우터 + SpaController + SecurityConfig 경로 3곳 모두 추가
```

"진행할까요?" 출력 후 대기.

### 3단계 — 구현
승인 받으면 Entity → Repository → DTO → Service → Controller → 프론트(페이지/컴포넌트) → API 연동 순서로 구현.

### 4단계 — 자체 점검 체크리스트
구현 완료 후 반드시 아래 항목 자체 점검:

#### Backend
- [ ] Entity가 BaseEntity 상속 (@CreatedDate/@LastModifiedDate 자동 적용)
- [ ] DTO ↔ Entity 변환 수행 (Entity 직접 반환 금지)
- [ ] 응답은 `ApiResponse<T>`, `ApiResponse.ok()` 사용 (`.success()` 아님)
- [ ] REST 엔드포인트가 `/api/` 접두사인지
- [ ] memberId는 `@AuthenticationPrincipal CustomUserDetails`에서 주입받는지 (하드코딩 절대 금지)
- [ ] 예외는 던지고 GlobalExceptionHandler에 위임 (컨트롤러/서비스에서 try-catch 남발 안 함)
- [ ] nullable Boolean/Integer 필드는 boxing NPE 가능성 체크 (`Boolean.TRUE.equals()` 패턴)
- [ ] MariaDB 예약어와 겹치는 컬럼명이면 `@Column(name = "\`...\`")` 백틱 처리
- [ ] 자식 테이블이 있으면 삭제 전 관련 레코드 먼저 삭제하는 cascade 로직 있는지
- [ ] N+1 가능성 있는 연관관계 조회는 fetch 전략(IN절 + Map 그룹핑 등) 명시했는지
- [ ] 신규 테이블이면 `ddl-auto: update`가 실제로 테이블을 생성했는지 개발자에게 확인 요청 (자동 생성 안 되는 케이스 존재)

#### Frontend
- [ ] 테이블형 UI라면 모바일 카드 리스트(`md:hidden`) + 데스크탑 테이블(`hidden md:block`) 이중 구현
- [ ] 모달은 모바일 바텀시트(`items-end, rounded-t-3xl`) + 데스크탑 중앙 팝업(`sm:items-center, sm:rounded-3xl`)
- [ ] 터치 타깃 최소 44px, 텍스트 잘림 방지(`min-w-0` + `truncate`), 가로 스크롤 없는 레이아웃
- [ ] memberId·categoryId 등 하드코딩 금지 — `getStoredMemberId()` 또는 API 조회 결과 사용
- [ ] 다크모드 클래스(`dark:`) 적용
- [ ] 새 라우트 추가 시 App.tsx 라우터 + `SpaController` + `SecurityConfig` permitAll 세 곳 모두 반영했는지

### 5단계 — 완료 보고
점검 결과와 함께 아래 형식으로 출력:

```
[/entity 완료]
생성 파일: N개
자체 점검: 통과 N건 / 수정 N건
DB 확인 필요: [Y/N] (신규 테이블 자동 생성 여부 — Y면 개발자가 직접 DB 확인 후 피드백)
다음 단계: /review 실행 권장
```
