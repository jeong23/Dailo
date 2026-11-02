# Dailo

## 프로젝트 개요
- 개인용 가계부 + 플래너 + 투자관리 풀스택 앱
- 모노레포: `Dailo/` 최상위에 단일 `.git` (GitHub: jeong23/LifePlan)
  - `backend/Dailo` — Spring Boot 3.5.x + Java 17 + JPA + MariaDB (포트 8888)
  - `frontend/Dailo` — React 19 + TypeScript + Tailwind CSS + Recharts (개발 포트 3000)
- 배포: React 빌드 후 `backend/Dailo/src/main/resources/static/`에 복사해서 Spring Boot 하나로 서빙
  - 외부 접근: Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:8888`)

## 문서 구조 (분할 로딩)
- **이 파일**: 공통 규칙만 — 항상 로드됨
- `backend/Dailo/CLAUDE.md`: 백엔드 규칙 + 백엔드 과거 실수 기록 (백엔드 파일 작업 시 자동 로드)
- `frontend/Dailo/CLAUDE.md`: 프론트 규칙 + 프론트 과거 실수 기록 (프론트 파일 작업 시 자동 로드)
- `docs/api-reference.md`: API 엔드포인트 전체 목록 (참고자료 — 필요할 때만 읽기)
- `docs/tax-calc.md`: 세액공제 계산기 상세 스펙 (참고자료 — 필요할 때만 읽기)
- 새 규칙/실수 기록 추가 시: 백엔드 것은 backend CLAUDE.md에, 프론트 것은 frontend CLAUDE.md에, 양쪽에 걸치면 이 파일에

## 빌드/배포/커밋 단축 명령 (Makefile + `~/.zshrc` alias 등록됨)
```
ship m="feat: 기능 추가"   # 프론트 빌드 + static 복사 + git 커밋 한 번에
ddeploy                    # 빌드 + static 복사만
dcommit m="fix: 버그 수정" # git add -A + commit만 (백엔드만 변경 시 사용)
dailo                      # /Users/user/Desktop/workspace/Dailo 로 이동
```
- `ship`/`dcommit`은 git commit을 포함하므로 자동 실행 금지 — 개발자가 직접 실행하거나 명시적으로 요청했을 때만 진행
- 커밋은 `Dailo/` 루트 기준으로 한 번만 하면 됨 (빌드 결과물 `static/static/` 등은 `.gitignore`로 제외)

## 공통 규칙
- 모든 앞단의 페이지는 web, mobile 화면단에 잘 나오게 설계해야 한다.
  → 터치 타깃 최소 44px, 텍스트 잘림 방지(min-w-0 + truncate), 가로 스크롤 없는 레이아웃
  → 모달은 모바일 바텀시트(items-end, rounded-t-3xl) + 데스크탑 중앙 팝업(sm:items-center, sm:rounded-3xl)
  → 테이블은 모바일 카드 리스트(lg:hidden) + 데스크탑 테이블(hidden lg:block) 이중 구현 (lg 기준 — 폴드 펼침 화면 대응)
- 컴파일/테스트/서버 기동은 Claude가 직접 실행해서 결과를 바로 확인한다
  → 백엔드: `./mvnw compile` / `./mvnw test` / `./mvnw spring-boot:run` (**`mvn`은 PATH에 없음 — 반드시 `./mvnw`**)
  → 프론트: `npm start` / `npm run build`
- 변경 확인 워크플로우: 프론트 dev 서버 따로 안 띄움 — `ddeploy`(빌드+static 복사) 후 백엔드 재시작해서 8888에서 확인
- git add/commit/push는 자동 실행 금지 — 개발자가 직접 하거나("`ship`/`dcommit` 실행해줘"처럼) 명시적으로 요청했을 때만 진행
- 새 SPA 페이지 추가 시 SpaController + SecurityConfig 두 곳 모두 경로 추가 필수

## 로그 기록 규칙 (logs/)
- `logs/analysis.log`: DB 구조 분석, 구현 방식 결정 등 "왜 이렇게 만들었는지"를 append (덮어쓰기 금지)
- `logs/errors.log`: 에러 발생~해결 과정을 append (덮어쓰기 금지)
- 기록 시점: DB 테이블 분석 완료 / 예상과 다른 구조 발견 / 구현 방식 결정 / 에러 발생 및 해결 시
- 각 CLAUDE.md의 "과거 실수 기록" 섹션은 로그 중에서 **다음 세션이 반드시 알아야 할 것만** 추려서 남기는 자리 — 로그 원문 전체를 옮기지 않음
- analysis.log 기록 형식:
  ```
  =================================
  [YYYY-MM-DD HH:MM] [기능명] [단계: DB분석/구현/에러해결]
  [발견] - 테이블/코드 구조 특이사항
  [결정] - 어떻게 구현했는지, 왜 이 방식을 선택했는지
  [주의사항] - 다음 작업자가 알아야 할 것
  =================================
  ```
- errors.log 기록 형식:
  ```
  =================================
  [YYYY-MM-DD HH:MM] [기능명]
  [증상]:
  [원인]:
  [해결]:
  [재발방지]: CLAUDE.md 과거 실수 기록에 추가했는지 여부
  =================================
  ```

## 다음 작업 후보
- [x] ~~🔴 DailyExpense 지출 집계 IDOR~~ — 2026-10-29 수정: member 컬럼 추가 대신 monthlyBudget.member로 소유자 판정, 지출·수입·습관·러닝·대시보드 통계 전부 회원 범위로 (backend CLAUDE.md 'IDOR 회원 범위 규칙')
- [x] ~~카테고리 누구나 수정·삭제~~ — 2026-11-02: 공용 유지 + 생성·수정·삭제는 member.role=ADMIN만(403). 가입·회원 수정 API로 role 지정하던 권한 상승도 막음 (관리자는 DB에서 지정)
- [ ] 런칭 전 법률 검토: 계좌별 매수 수량 안내가 투자자문/유사투자자문에 해당하는지 (현재는 사용자가 넣은 종목·규칙만 계산, 상품 추천 없음) [공통]
- [x] ~~N+1 쿼리 개선~~ — 2026-11-02: DailyExpenseRepository.sumByMonth / IncomeRepository.sumByMonth 정산월별 그룹 쿼리 1번씩