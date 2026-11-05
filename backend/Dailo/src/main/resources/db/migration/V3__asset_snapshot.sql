-- 월말 순자산 스냅샷 — 자산 현황 화면을 열 때 그 정산월 값을 덮어씀 (마지막 기록 = 그 달 말 값)
CREATE TABLE `asset_snapshot` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `member_id` bigint(20) NOT NULL,
  `settle_month` varchar(7) NOT NULL,
  `cash` bigint(20) NOT NULL DEFAULT 0,
  `invest` bigint(20) NOT NULL DEFAULT 0,
  `savings` bigint(20) NOT NULL DEFAULT 0,
  `manual` bigint(20) NOT NULL DEFAULT 0,
  `captured_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asset_snapshot_member_month` (`member_id`, `settle_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
