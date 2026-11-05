-- 2026-11-05 기준 스키마 (Hibernate ddl-auto update로 만들어진 운영 DB를 그대로 떠 옴)
-- 기존 DB: baseline-on-migrate로 이 파일은 건너뛰고 '1'로 표시만 됨 / 새 DB: 이 파일로 전체 테이블 생성
-- 이 파일은 고치지 말 것 — 스키마 변경은 V{다음 번호}__설명.sql 새 파일로 (Flyway checksum)
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `asset_bucket` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `kind` varchar(10) NOT NULL,
  `manual_amount` bigint(20) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `target_pct` float NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_asset_bucket_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `budget_allocation_item` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `monthly_budget_id` bigint(20) NOT NULL,
  `label` varchar(50) NOT NULL,
  `rate` decimal(5,4) NOT NULL DEFAULT 0.0000,
  `budget_amount` int(11) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `input_mode` varchar(10) NOT NULL DEFAULT 'RATE',
  `invest_account_id` bigint(20) DEFAULT NULL,
  `savings_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_budget_allocation_item_budget_label` (`monthly_budget_id`,`label`),
  CONSTRAINT `FK_budget_alloc_item_monthly_budget` FOREIGN KEY (`monthly_budget_id`) REFERENCES `monthly_budget` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `cash_account` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `active` bit(1) DEFAULT NULL,
  `balance` bigint(20) NOT NULL,
  `bank` varchar(30) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `memo` varchar(200) DEFAULT NULL,
  `name` varchar(50) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `balance_as_of` datetime(6) DEFAULT NULL,
  `balance_month` varchar(7) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `cash_asset` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `balance` int(11) NOT NULL,
  `living_surplus_applied` int(11) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `memo` varchar(200) DEFAULT NULL,
  `settle_month` varchar(7) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cash_asset_member_settlemonth` (`member_id`,`settle_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `category` (
  `sort_order` int(11) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `icon` varchar(10) DEFAULT NULL,
  `name` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK46ccwnsi9409t36lurvtyljak` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `daily_expense` (
  `amount` int(11) DEFAULT NULL,
  `expense_date` date DEFAULT NULL,
  `settle_month` varchar(7) DEFAULT NULL,
  `category_id` bigint(20) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `monthly_budget_id` bigint(20) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `budget_type` varchar(10) DEFAULT NULL,
  `payment_method` varchar(10) DEFAULT NULL,
  `item_name` varchar(100) DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `cash_account_id` bigint(20) DEFAULT NULL,
  `savings_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKe6jpkudtlknnld070sukh04ne` (`category_id`),
  KEY `FKirtw6x7c57me0l73kkkdip3vl` (`monthly_budget_id`),
  CONSTRAINT `FKe6jpkudtlknnld070sukh04ne` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`),
  CONSTRAINT `FKirtw6x7c57me0l73kkkdip3vl` FOREIGN KEY (`monthly_budget_id`) REFERENCES `monthly_budget` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `daily_plan` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `feedback_end` varchar(500) DEFAULT NULL,
  `feedback_mid` varchar(500) DEFAULT NULL,
  `feedback_start` varchar(500) DEFAULT NULL,
  `first_task` varchar(255) DEFAULT NULL,
  `future_vision_url` varchar(255) DEFAULT NULL,
  `gratitude1` varchar(255) DEFAULT NULL,
  `gratitude2` varchar(255) DEFAULT NULL,
  `gratitude3` varchar(255) DEFAULT NULL,
  `identity1` varchar(255) DEFAULT NULL,
  `identity2` varchar(255) DEFAULT NULL,
  `identity3` varchar(255) DEFAULT NULL,
  `motivation1` varchar(255) DEFAULT NULL,
  `motivation2` varchar(255) DEFAULT NULL,
  `motivation3` varchar(255) DEFAULT NULL,
  `plan_date` date NOT NULL,
  `member_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_daily_plan_member_date` (`member_id`,`plan_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `fixed_cost` (
  `amount` int(11) DEFAULT NULL,
  `is_active` bit(1) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `member_id` bigint(20) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `name` varchar(50) NOT NULL,
  `cost_type` varchar(20) DEFAULT NULL,
  `installment_end` date DEFAULT NULL,
  `installment_months` int(11) DEFAULT NULL,
  `installment_start` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK4lmtm8wj1h3jyug9jx0fp8je6` (`member_id`),
  CONSTRAINT `FK4lmtm8wj1h3jyug9jx0fp8je6` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `habit` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `color` varchar(20) DEFAULT NULL,
  `emoji` varchar(10) DEFAULT NULL,
  `is_active` bit(1) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `habit_type` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `habit_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `log_date` date NOT NULL,
  `habit_id` bigint(20) NOT NULL,
  `count` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKc8sgaspi2r3nfgpgtu93m3ek0` (`habit_id`,`log_date`),
  CONSTRAINT `FKmy4pmvasgdoyfptudvarv5gv1` FOREIGN KEY (`habit_id`) REFERENCES `habit` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `income` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `amount` int(11) DEFAULT NULL,
  `income_date` date DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `settle_month` varchar(7) DEFAULT NULL,
  `source` varchar(50) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `cash_account_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKche46c7attf0i9e8lu912o8aq` (`member_id`),
  CONSTRAINT `FKche46c7attf0i9e8lu912o8aq` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `invest_account` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `target_pct` float NOT NULL,
  `type` varchar(20) NOT NULL,
  `monthly_amount` int(11) DEFAULT NULL,
  `purpose` varchar(20) DEFAULT NULL,
  `target_date` varchar(7) DEFAULT NULL,
  `active` bit(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `invest_diary` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `date` date NOT NULL,
  `market_mood` varchar(20) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `my_emotion` varchar(20) DEFAULT NULL,
  `title` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `invest_holding` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `target_pct` float NOT NULL,
  `ticker` varchar(100) NOT NULL,
  `account_id` bigint(20) NOT NULL,
  `avg_purchase_price` int(11) DEFAULT NULL,
  `shares` float DEFAULT NULL,
  `stock_code` varchar(12) DEFAULT NULL,
  `manual_value` int(11) DEFAULT NULL,
  `theme_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK5owsqmhxaoos9d15dhfovkdab` (`account_id`),
  CONSTRAINT `FK5owsqmhxaoos9d15dhfovkdab` FOREIGN KEY (`account_id`) REFERENCES `invest_account` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `invest_monthly_record` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `holding_id` bigint(20) NOT NULL,
  `year_month` varchar(7) NOT NULL,
  `planned_amt` int(11) DEFAULT NULL,
  `actual_amt` int(11) DEFAULT NULL,
  `is_paid` bit(1) DEFAULT NULL,
  `current_pct` float DEFAULT NULL,
  `eval_amt` int(11) DEFAULT NULL,
  `current_price` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_invest_monthly_record` (`holding_id`,`year_month`),
  CONSTRAINT `FK_invest_mr_holding` FOREIGN KEY (`holding_id`) REFERENCES `invest_holding` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `invest_setting` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `monthly_budget` int(11) DEFAULT NULL,
  `pension_limit` int(11) NOT NULL,
  `rebalance_threshold` float NOT NULL,
  `allow_sell` bit(1) DEFAULT NULL,
  `strategy_preset` varchar(20) DEFAULT NULL,
  `tax_join_month` int(11) DEFAULT NULL,
  `tax_prob_end_month` int(11) DEFAULT NULL,
  `tax_probation` bit(1) DEFAULT NULL,
  `deposited_month` varchar(7) DEFAULT NULL,
  `fee_rate` float DEFAULT NULL,
  `price_buffer` float DEFAULT NULL,
  `rebalance_mode` bit(1) DEFAULT NULL,
  `profit_take_pct` float DEFAULT NULL,
  `rebalance_style` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKo7r1wlo1tiocf2bcrd38dax3q` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `invest_theme` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `cash` bit(1) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `target_pct` float NOT NULL,
  `satellite` bit(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_invest_theme_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `invest_trade` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `account_id` bigint(20) NOT NULL,
  `avg_before` int(11) DEFAULT NULL,
  `holding_id` bigint(20) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  `price` int(11) NOT NULL,
  `shares` float NOT NULL,
  `shares_before` float DEFAULT NULL,
  `side` varchar(4) NOT NULL,
  `stock_code` varchar(12) DEFAULT NULL,
  `ticker` varchar(100) NOT NULL,
  `trade_date` date NOT NULL,
  `cash_delta` int(11) DEFAULT NULL,
  `cash_holding_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_invest_trade_member_date` (`member_id`,`trade_date`),
  KEY `idx_invest_trade_holding` (`holding_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `member` (
  `salary_gross` int(11) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `updated_at` datetime(6) DEFAULT NULL,
  `role` varchar(20) NOT NULL,
  `name` varchar(30) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `salary_day` int(11) DEFAULT 25,
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKgc3jmn7c2abyo3wf6syln5t2i` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `member_note` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `content` text DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `note_key` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_note_key` (`member_id`,`note_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `monthly_budget` (
  `available_amount` int(11) DEFAULT NULL,
  `card_goal` int(11) DEFAULT NULL,
  `discretionary_budget` int(11) DEFAULT NULL,
  `emergency_budget` int(11) DEFAULT NULL,
  `emergency_cumulative` int(11) DEFAULT NULL,
  `fixed_cost_total` int(11) DEFAULT NULL,
  `isa_amount` int(11) DEFAULT NULL,
  `living_budget` int(11) DEFAULT NULL,
  `living_carryover` int(11) DEFAULT NULL,
  `net_salary` int(11) DEFAULT NULL,
  `pension_amount` int(11) DEFAULT NULL,
  `settle_month` varchar(7) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `member_id` bigint(20) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `discretionary_rate` decimal(5,4) NOT NULL DEFAULT 0.1000,
  `emergency_rate` decimal(5,4) NOT NULL DEFAULT 0.1500,
  `isa_rate` decimal(5,4) NOT NULL DEFAULT 0.2500,
  `living_rate` decimal(5,4) NOT NULL DEFAULT 0.3500,
  `pension_rate` decimal(5,4) NOT NULL DEFAULT 0.1500,
  PRIMARY KEY (`id`),
  KEY `FKq973202q2iftl5tt9569tm1ta` (`member_id`),
  CONSTRAINT `FKq973202q2iftl5tt9569tm1ta` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `running_goal` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `month` int(11) NOT NULL,
  `target_count` int(11) NOT NULL,
  `target_distance_km` double DEFAULT NULL,
  `year` int(11) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_running_goal_member_ym` (`member_id`,`year`,`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `running_record` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `distance_km` double DEFAULT NULL,
  `memo` varchar(500) DEFAULT NULL,
  `ran` bit(1) NOT NULL,
  `route_json` text DEFAULT NULL,
  `run_date` date NOT NULL,
  `avg_heart_rate` int(11) DEFAULT NULL,
  `cadence` int(11) DEFAULT NULL,
  `calories` int(11) DEFAULT NULL,
  `duration_seconds` int(11) DEFAULT NULL,
  `elevation_gain` int(11) DEFAULT NULL,
  `title` varchar(100) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_running_record_member_date` (`member_id`,`run_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `savings` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `bank` varchar(50) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `memo` varchar(200) DEFAULT NULL,
  `monthly_amount` bigint(20) NOT NULL,
  `months` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `paid_override` int(11) DEFAULT NULL,
  `rate_pct` float NOT NULL,
  `start_date` date NOT NULL,
  `tax_free` bit(1) NOT NULL,
  `balance_override` bigint(20) DEFAULT NULL,
  `household_head` bit(1) DEFAULT NULL,
  `kind` varchar(20) DEFAULT NULL,
  `region` varchar(20) DEFAULT NULL,
  `bonus_balance` bigint(20) DEFAULT NULL,
  `monthly_bonus` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_savings_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `time_box_block` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `content` varchar(500) DEFAULT NULL,
  `end_hour` int(11) NOT NULL,
  `end_slot` int(11) NOT NULL,
  `is_done` bit(1) NOT NULL,
  `plan_date` date NOT NULL,
  `start_hour` int(11) NOT NULL,
  `start_slot` int(11) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_time_box_block_member_date` (`member_id`,`plan_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `time_box_slot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `hour` int(11) NOT NULL,
  `plan_date` date NOT NULL,
  `slot1` varchar(100) DEFAULT NULL,
  `slot2` varchar(100) DEFAULT NULL,
  `slot1done` bit(1) NOT NULL,
  `slot2done` bit(1) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_time_box_slot_member_date_hour` (`member_id`,`plan_date`,`hour`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `todo_item` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `content` varchar(200) NOT NULL,
  `is_done` bit(1) NOT NULL,
  `plan_date` date NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `type` varchar(20) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_todo_item_member_date` (`member_id`,`plan_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `vision_board_item` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `h` double NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  `w` double NOT NULL,
  `x` double NOT NULL,
  `y` double NOT NULL,
  `z` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vision_board_item_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `workout_bookmark` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `exercise_name` varchar(100) NOT NULL,
  `member_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKxby9hfi92ymhr8akkbwp49c0` (`member_id`,`exercise_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `workout_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `memo` varchar(500) DEFAULT NULL,
  `routine_id` bigint(20) DEFAULT NULL,
  `workout_date` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK4k9ck7nynhq8pkku6o9g6lbp` (`member_id`,`workout_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `workout_routine` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `workout_routine_exercise` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `exercise_name` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `target_sets` int(11) DEFAULT NULL,
  `routine_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKmq0fg4ltorusojiof0rqp8o1n` (`routine_id`),
  CONSTRAINT `FKmq0fg4ltorusojiof0rqp8o1n` FOREIGN KEY (`routine_id`) REFERENCES `workout_routine` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `workout_set` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `exercise_name` varchar(100) NOT NULL,
  `exercise_sort_order` int(11) NOT NULL,
  `is_done` bit(1) NOT NULL,
  `reps` int(11) DEFAULT NULL,
  `set_number` int(11) NOT NULL,
  `weight_kg` float DEFAULT NULL,
  `workout_log_id` bigint(20) NOT NULL,
  `set_type` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKm4k3fviadthqq36xaxp0tj29e` (`workout_log_id`),
  CONSTRAINT `FKm4k3fviadthqq36xaxp0tj29e` FOREIGN KEY (`workout_log_id`) REFERENCES `workout_log` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
