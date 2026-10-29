-- 플래너 데이터 회원별 분리 (daily_plan / todo_item / time_box_slot / time_box_block)
--
-- 실행 시점: 새 백엔드 jar로 재시작하기 "전"에 실행 권장.
--   ddl-auto: update 는 member_id NOT NULL 컬럼을 추가하면서 기존 행을 0으로 채우고,
--   기존 unique(plan_date), unique(plan_date, hour) 인덱스는 지우지 않는다.
--   → 그대로 두면 기존 데이터가 안 보이고, 두 번째 회원은 같은 날짜에 플랜을 만들 수 없다.
--   이미 재시작했다면 이 스크립트를 그대로 실행하면 된다 (member_id = 0 행도 처리, 재실행 안전).
--
-- 대상 회원: 기존 데이터의 주인 = member.id 1 (wjddyd757). 실행 전 아래 SELECT로 확인할 것.
--   SELECT id, username FROM member;
--
-- 실행 예: mariadb -h127.0.0.1 -P3333 -ubudget -p budget_dashboard < 2026-10-28_planner_member_scope.sql

SET @owner := 1;

START TRANSACTION;

-- 1) 컬럼 추가 (nullable) — 이미 있으면 건너뜀
ALTER TABLE daily_plan     ADD COLUMN IF NOT EXISTS member_id BIGINT NULL;
ALTER TABLE todo_item      ADD COLUMN IF NOT EXISTS member_id BIGINT NULL;
ALTER TABLE time_box_slot  ADD COLUMN IF NOT EXISTS member_id BIGINT NULL;
ALTER TABLE time_box_block ADD COLUMN IF NOT EXISTS member_id BIGINT NULL;

-- 2) 기존 행을 단일 회원에게 귀속 (ddl-auto가 먼저 돌아 0으로 채워진 경우 포함)
UPDATE daily_plan     SET member_id = @owner WHERE member_id IS NULL OR member_id = 0;
UPDATE todo_item      SET member_id = @owner WHERE member_id IS NULL OR member_id = 0;
UPDATE time_box_slot  SET member_id = @owner WHERE member_id IS NULL OR member_id = 0;
UPDATE time_box_block SET member_id = @owner WHERE member_id IS NULL OR member_id = 0;

COMMIT;

-- 3) NOT NULL 지정 (엔티티 @Column(nullable = false)와 일치)
ALTER TABLE daily_plan     MODIFY member_id BIGINT NOT NULL;
ALTER TABLE todo_item      MODIFY member_id BIGINT NOT NULL;
ALTER TABLE time_box_slot  MODIFY member_id BIGINT NOT NULL;
ALTER TABLE time_box_block MODIFY member_id BIGINT NOT NULL;

-- 4) 전역 unique 제거 → 회원 단위 unique로 교체
--    (2026-10-28 기준 실제 DB의 Hibernate 자동 생성 이름)
ALTER TABLE daily_plan    DROP INDEX IF EXISTS UKn8l523l9sjat53h9hu852mg57;   -- unique(plan_date)
ALTER TABLE time_box_slot DROP INDEX IF EXISTS UKtbldnge8lyydpgq7p5m8rc6tv;   -- unique(plan_date, hour)

ALTER TABLE daily_plan     ADD UNIQUE INDEX IF NOT EXISTS uk_daily_plan_member_date (member_id, plan_date);
ALTER TABLE time_box_slot  ADD UNIQUE INDEX IF NOT EXISTS uk_time_box_slot_member_date_hour (member_id, plan_date, hour);
ALTER TABLE todo_item      ADD INDEX IF NOT EXISTS idx_todo_item_member_date (member_id, plan_date);
ALTER TABLE time_box_block ADD INDEX IF NOT EXISTS idx_time_box_block_member_date (member_id, plan_date);

-- 5) 검증: 0이어야 함
SELECT 'daily_plan' t, COUNT(*) FROM daily_plan WHERE member_id NOT IN (SELECT id FROM member)
UNION ALL SELECT 'todo_item', COUNT(*) FROM todo_item WHERE member_id NOT IN (SELECT id FROM member)
UNION ALL SELECT 'time_box_slot', COUNT(*) FROM time_box_slot WHERE member_id NOT IN (SELECT id FROM member)
UNION ALL SELECT 'time_box_block', COUNT(*) FROM time_box_block WHERE member_id NOT IN (SELECT id FROM member);
