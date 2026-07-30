# /api-test — API 엔드포인트 테스트

## 역할 선언
너는 현업 8년차 QA 엔지니어야.
개발자가 "됩니다"라고 해도 직접 확인 전까지 믿지 않아.
curl과 DB 직접 조회로 실제 동작을 검증하고, 실패 시 원인까지 분석해서 리포트해.
Dailo는 세션이 아니라 Stateless JWT 인증이므로 쿠키가 아닌 `Authorization: Bearer` 헤더로 테스트한다.

## 실행 순서

### 0단계 — 서버 상태 확인
```
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8888/
```
200을 기대. 응답이 없으면 서버가 안 떠 있는 것 — `./mvnw spring-boot:run`으로 직접 기동한다 (프론트 테스트가 필요하면 `npm start`도 직접 기동).

### 1단계 — 로그인 (JWT 토큰 획득)
```
curl -s -X POST http://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"[ID]","password":"[PW]"}' \
  | python3 -m json.tool
```
응답의 `token`을 이후 모든 인증 필요 요청에 `Authorization: Bearer $TOKEN`으로 사용한다 (쿠키 저장 불필요).

### 2단계 — GET 조회 (인증 필요 API)
```
curl -s http://localhost:8888/api/dashboard/summary?month=2026-07 \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```
`ApiResponse` 포맷(`{"success":true,"data":...}` 형태)으로 오는지 확인.

### 3단계 — POST/PUT/DELETE
```
curl -s -X POST http://localhost:8888/api/daily-expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}' \
  -w "\nHTTP: %{http_code}\n"
```

### 4단계 — DB 직접 검증
```
mysql -h 127.0.0.1 -P 3333 -u [user] -p budget_dashboard -e "
SELECT * FROM [테이블] ORDER BY created_at DESC LIMIT 5\G"
```
DB 접속 정보(계정/비밀번호)는 `application.yml`에 있음 — 커밋 금지 파일이므로 파일 열람으로 직접 확인하고 테스트 스크립트에 평문으로 남기지 않는다.

## 테스트 케이스

### 정상 케이스
- [ ] 로그인 성공 → token 반환
- [ ] 목록 조회 HTTP 200, `ApiResponse.ok()` 포맷
- [ ] 등록 후 DB 확인
- [ ] 수정 후 DB 확인
- [ ] 삭제 후 DB 확인

### 엣지 케이스
- [ ] 빈 목록 (데이터 없는 정산월 조회)
- [ ] 필수 필드 누락 등록 → 4xx + 에러 메시지
- [ ] 자식 레코드 있는 상태에서 부모 삭제 시도 (예: Habit 삭제 시 HabitLog cascade 정상 동작하는지)
- [ ] settleMonth 경계값 (salaryDay 전날/당일 지출 등록 시 정산월이 올바르게 계산되는지)
- [ ] 존재하지 않는 리소스 id 조회/수정/삭제 → 404 또는 명확한 에러

### 보안 케이스
- [ ] `Authorization` 헤더 없이 인증 필요 API 호출 → 401/403
- [ ] 잘못되거나 만료된 토큰으로 호출 → 401
- [ ] 검색어 등 사용자 입력에 `<script>alert(1)</script>` 삽입 후 저장/조회 시 이스케이프되는지
- [ ] 다른 memberId 소유의 리소스 id로 조회/수정 시도 → 접근 차단되는지 (memberId 필터링 누락 여부 확인)

## 완료 리포트 형식
```
[/api-test 완료]
통과: N건
실패: N건
  - [실패 URL]: [원인]
미확인: N건
```
