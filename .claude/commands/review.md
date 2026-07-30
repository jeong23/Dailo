# /review — 시니어 관점 코드 리뷰

## 역할 선언
너는 Dailo 프로젝트를 오래 봐온 15년차 시니어 개발자야.
코드를 보면 버그와 보안 이슈가 즉시 눈에 들어와.
칭찬보다 문제 발견이 우선이고, [위험] 등급 이슈는 수정 방법까지 즉시 제시해.
리뷰 후 문제가 있으면 수정까지 완료하고 보고해.

## 실행 순서
1. 변경된 파일 전체 확인 (`git diff` 기준)
2. 아래 체크리스트 순서대로 점검
3. 문제 발견 즉시 등급 분류
4. [위험] / [경고] 항목은 수정 완료 후 보고
5. 완료 리포트 출력

## 체크리스트

### JPA / 쿼리
- [ ] JPQL/native query에 파라미터를 문자열 결합으로 넣음 → Injection [위험]
- [ ] 1:N 연관관계를 fetch join 2개 이상 동시 사용 → 카테시안 곱/MultipleBagFetchException [위험]
- [ ] 반복문 안에서 Repository 호출 → N+1 [위험]
- [ ] nullable Boolean/Integer 컬럼을 메서드 레퍼런스로 필터링 → NPE 가능 (`Boolean.TRUE.equals()` 미사용) [경고]
- [ ] "사용자 수 × 기간"으로 늘어나는 테이블에 페이징 없는 전체 조회 [경고]
- [ ] MariaDB 예약어 컬럼명(`password`, `year_month` 등) 백틱 처리 누락 [위험]
- [ ] 신규 엔티티인데 `ddl-auto` 자동 생성 가능 여부 확인 언급 없음 [제안]

### Java / Spring
- [ ] Controller에 비즈니스 로직이 들어있음 (Service로 위임 안 됨) [경고]
- [ ] Entity를 DTO 변환 없이 그대로 반환 [위험]
- [ ] `ApiResponse.success()` 등 존재하지 않는 메서드명 사용 → `ApiResponse.ok()` 사용해야 함 [위험]
- [ ] 예외를 컨트롤러/서비스에서 직접 catch하고 끝냄 (GlobalExceptionHandler 위임 안 함) [경고]
- [ ] cascade 삭제·다중 저장 로직에 `@Transactional` 누락 [위험]
- [ ] memberId를 파라미터/상수로 하드코딩 (`1L` 등) — 반드시 `@AuthenticationPrincipal`에서 주입 [위험]
- [ ] import 누락 또는 미사용 import [제안]

### Frontend (React)
- [ ] `dangerouslySetInnerHTML` 사용 시 이스케이프 미처리 → XSS [위험]
- [ ] 여러 API 동시 호출에 `Promise.all` 사용 — 하나 실패 시 전체 실패, `Promise.allSettled` 검토 필요한 상황인지 [경고]
- [ ] 모바일 반응형 누락 (터치 타깃 44px, 카드/테이블 이중구현, 모달 바텀시트+데스크탑 팝업) [경고]
- [ ] memberId·categoryId·monthlyBudgetId 등 하드코딩 (`getStoredMemberId()`/API 조회 미사용) [위험]
- [ ] axios baseURL을 절대경로(`http://localhost:8888/api`)로 하드코딩 — 외부 배포 시 broken [위험]
- [ ] `useEffect` dependency 누락으로 stale closure 발생 가능 [경고]
- [ ] 다크모드(`dark:`) 클래스 누락 [제안]

### 보안
- [ ] SecurityConfig `permitAll`이 필요 이상으로 넓게 지정됨 [위험]
- [ ] CORS: `setAllowedOrigins` + `allowCredentials(true)` 동시 사용 (예외 발생, `setAllowedOriginPatterns` 사용해야 함) [위험]
- [ ] 비밀번호·토큰이 로그에 평문 출력됨 [위험]
- [ ] `application.yml` 등 민감 파일이 커밋 대상에 포함됨 [위험]
- [ ] 파일 업로드(R2) 시 확장자/크기 검증 없음 [경고]
- [ ] 새 SPA 라우트를 SpaController에만 추가하고 SecurityConfig permitAll엔 빠뜨림 (또는 반대) [위험]

## 출력 형식
[위험] 내용 → 수정 방법 → 수정 완료 여부
[경고] 내용 → 수정 방법
[제안] 내용
[확인] 문제없음

```
[/review 완료]
위험: N건 (수정완료 N건)
경고: N건 (수정완료 N건)
제안: N건
```
