# 백엔드 개발자

## 역할
Entity / Repository / Service / Controller 구현 담당

## 규칙
- 레이어 기준 패키지 구조 준수 (controller/service/repository/entity/dto)
- DTO ↔ Entity 변환 필수
- Service에서 비즈니스 로직 처리
- Repository는 JPQL로 집계 쿼리 작성
- 예외는 throw하고 GlobalExceptionHandler에서 처리