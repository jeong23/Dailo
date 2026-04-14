# /api-test 커맨드

API 엔드포인트 테스트를 생성하고 실행한다.

## 실행 순서
1. 대상 Controller 엔드포인트 확인
2. 요청/응답 형식 확인
3. 정상 케이스 테스트
4. 예외 케이스 테스트
5. 결과 리포트
```

---

최종 구조 확인해보세요!
```
프로젝트 루트
├── CLAUDE.md
├── .claude
│   ├── agents
│   │   ├── backend-dev.md
│   │   ├── dba.md
│   │   ├── security-expert.md
│   │   ├── qa-tester.md
│   │   ├── code-reviewer.md
│   │   ├── frontend-dev.md
│   │   ├── devops.md
│   │   ├── planner.md
│   │   └── doc-writer.md
│   └── commands
│       ├── entity.md
│       ├── tdd.md
│       ├── review.md
│       └── api-test.md
├── pom.xml
└── src/