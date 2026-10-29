-- 러닝 데이터 회원별 분리 (running_record / running_goal)
--
-- 실행 시점: 새 백엔드로 재시작하기 "전"에 실행 권장 (2026-10-28 플래너 이관과 같은 방식).
--   ddl-auto: update 는 member_id NOT NULL 컬럼을 추가하면서 기존 행을 0으로 채우고,
--   기존 unique(year, month)는 지우지 않는다 → 두 번째 회원이 같은 달 목표를 못 만든다.
--   이미 재시작했다면 그대로 실행하면 된다 (member_id = 0 행도 처리, 재실행 안전).
--
-- 대상 회원: 기존 데이터의 주인 = member.id 1 (wjddyd757). 실행 전 SELECT id, username FROM member; 로 확인.

SET @owner := 1;

START TRANSACTION;
ALTER TABLE running_record ADD COLUMN IF NOT EXISTS member_id BIGINT NULL;
ALTER TABLE running_goal   ADD COLUMN IF NOT EXISTS member_id BIGINT NULL;
UPDATE running_record SET member_id = @owner WHERE member_id IS NULL OR member_id = 0;
UPDATE running_goal   SET member_id = @owner WHERE member_id IS NULL OR member_id = 0;
COMMIT;

ALTER TABLE running_record MODIFY member_id BIGINT NOT NULL;
ALTER TABLE running_goal   MODIFY member_id BIGINT NOT NULL;

-- 전역 unique(year, month) → 회원 단위 (2026-10-29 기준 Hibernate 자동 생성 이름)
ALTER TABLE running_goal DROP INDEX IF EXISTS UKiaxf3y1qxeyhlom4r2yexsvg5;
ALTER TABLE running_goal   ADD UNIQUE INDEX IF NOT EXISTS uk_running_goal_member_ym (member_id, year, month);
ALTER TABLE running_record ADD INDEX IF NOT EXISTS idx_running_record_member_date (member_id, run_date);

-- 검증: 0이어야 함
SELECT 'running_record' t, COUNT(*) FROM running_record WHERE member_id NOT IN (SELECT id FROM member)
UNION ALL SELECT 'running_goal', COUNT(*) FROM running_goal WHERE member_id NOT IN (SELECT id FROM member);
