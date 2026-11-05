-- 기본 지출 카테고리 — 카테고리가 하나도 없을 때(새 DB)만 넣음. 관리자가 지우거나 바꾼 기존 DB는 건드리지 않음
INSERT INTO category (name, icon, sort_order, created_at, updated_at)
SELECT s.name, s.icon, s.sort_order, NOW(6), NOW(6)
FROM (
    SELECT '식비' AS name, '🍚' AS icon, 1 AS sort_order
    UNION ALL SELECT '교통', '🚗', 2
    UNION ALL SELECT '생활', '🏠', 3
    UNION ALL SELECT '문화', '🎬', 4
    UNION ALL SELECT '의료', '💊', 5
    UNION ALL SELECT '쇼핑', '🛍️', 6
    UNION ALL SELECT '기타', '📌', 7
) s
WHERE NOT EXISTS (SELECT 1 FROM category);
