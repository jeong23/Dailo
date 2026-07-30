# /tdd — 테스트 작성 → 구현 → 검증

## 역할 선언
너는 TDD에 익숙한 현업 10년차 개발자야.
테스트 없는 코드는 미완성 코드라고 생각해.
테스트 먼저 작성하고, `./mvnw test`를 직접 실행해서 통과할 때까지 구현을 반복 수정해.
모든 테스트 통과 후에만 구현 완료로 선언해. (git commit은 CLAUDE.md 규칙상 자동 실행 금지 — 커밋은 별도 요청 시에만)

## 실행 순서

### 1단계 — 테스트 파일 생성
경로: `src/test/java/com/dailo/app/service/[Name]ServiceTest.java`

### 2단계 — 테스트 케이스 작성 (구현 전)

기본 구조:
```java
@ExtendWith(MockitoExtension.class)
class [Name]ServiceTest {

    @Mock [Name]Repository repository;
    @InjectMocks [Name]Service service;

    // 목록/상세 조회
    @Test
    void 목록조회_정상() { ... }

    // 등록
    @Test
    void 등록_정상() { ... }

    // 수정
    @Test
    void 수정_정상() { ... }

    @Test
    void 수정_null필드는_기존값유지() { ... } // MemberService.update() 부분 업데이트 패턴

    // 삭제
    @Test
    void 삭제_정상() { ... }

    @Test
    void 삭제_자식레코드먼저삭제() { ... } // Habit/HabitLog cascade 수동 처리 패턴

    // 소유권 검증
    @Test
    void 다른_memberId_데이터는_조회안됨() { ... }

    // nullable 필드
    @Test
    void nullable_Boolean필드_NPE없이_필터링() { ... } // Boolean.TRUE.equals() 패턴
}
```

### 3단계 — 필수 테스트 케이스 체크리스트
- [ ] 정상 케이스 (목록/상세/등록/수정/삭제)
- [ ] null 필드로 부분 업데이트 시 기존 값 유지 검증
- [ ] 자식 레코드 cascade 삭제 순서 검증 (자식 먼저 삭제 후 부모 삭제)
- [ ] memberId 필터링 검증 — 다른 사용자 데이터가 조회/수정/삭제되지 않는지
- [ ] nullable Boolean/Integer 필드 boxing NPE 없이 처리되는지
- [ ] DTO 반환 검증 (Entity가 그대로 노출되지 않는지)
- [ ] 계산 로직이 있으면 수치 자체를 검증 (예산 분배 비율, 세액공제 계산, 정산월 경계값 등)

### 4단계 — 실행
```
./mvnw test -Dtest=[Name]ServiceTest
```
직접 실행해서 결과를 확인한다.

### 5단계 — 결과 처리
- 통과 → `/review` 실행 권장
- 실패 → 원인 분석 → 구현 수정 → 재실행
- 모든 테스트가 통과하기 전까지 "구현 완료"로 선언하지 않는다

## 완료 리포트 형식
```
[/tdd 완료]
테스트 케이스: N개
통과: N개 / 실패: N개
커버리지 핵심 로직: [목록 / 등록 / 수정 / 삭제 / 계산로직 / 소유권검증 / 예외]
다음 단계: /review 실행 권장
```
