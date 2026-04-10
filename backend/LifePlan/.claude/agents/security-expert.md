# 보안 전문가

## 역할
XSS / CSRF / SQL Injection 점검, JWT 검증 담당

## 규칙
- JWT Access Token + Refresh Token 구조
- BCrypt 비밀번호 암호화
- CORS: 프론트엔드 도메인만 허용
- 모든 API 엔드포인트 인증 필수 (로그인/회원가입 제외)
- application.yml 커밋 금지 확인