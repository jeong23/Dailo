package com.dailo.app.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

// 탈퇴 유예가 끝난 회원의 데이터를 전부 지운다 (개인정보 파기).
// 새 회원 데이터 테이블을 만들면 여기 추가 — MemberPurgeServiceTest가 member_id 엔티티 누락을 잡는다
// (DataExportService.GROUPS에도 추가 — DataExportServiceTest가 이 목록 기준으로 내보내기 누락을 잡는다)
@Slf4j
@Service
@RequiredArgsConstructor
public class MemberPurgeService {

    // member_id가 없는 자식 테이블 — 부모(회원 테이블)보다 먼저 지움. {자식, FK 컬럼, 이 회원의 부모 id 조회}
    static final List<String[]> CHILD_TABLES = List.of(
            new String[]{"invest_monthly_record", "holding_id",
                    "SELECT h.id FROM invest_holding h JOIN invest_account a ON h.account_id = a.id WHERE a.member_id = ?"},
            new String[]{"invest_holding", "account_id", "SELECT id FROM invest_account WHERE member_id = ?"},
            new String[]{"daily_expense", "monthly_budget_id", "SELECT id FROM monthly_budget WHERE member_id = ?"},
            new String[]{"budget_allocation_item", "monthly_budget_id", "SELECT id FROM monthly_budget WHERE member_id = ?"},
            new String[]{"habit_log", "habit_id", "SELECT id FROM habit WHERE member_id = ?"},
            new String[]{"workout_set", "workout_log_id", "SELECT id FROM workout_log WHERE member_id = ?"},
            new String[]{"workout_routine_exercise", "routine_id", "SELECT id FROM workout_routine WHERE member_id = ?"}
    );

    // member_id 컬럼이 있는 테이블 — 서로 FK 없음 (member만 참조)
    static final List<String> MEMBER_TABLES = List.of(
            "invest_trade", "invest_account", "invest_theme", "invest_setting", "invest_diary",
            "monthly_budget", "fixed_cost", "income",
            "cash_account", "cash_asset", "savings", "asset_bucket", "asset_snapshot", "member_note",
            "daily_plan", "todo_item", "time_box_slot", "time_box_block", "vision_board_item",
            "habit", "running_record", "running_goal",
            "workout_log", "workout_routine", "workout_bookmark"
    );

    private final JdbcTemplate jdbc;
    private final ImageCleanupService imageCleanup;

    @Transactional
    public void purge(Long memberId) {
        // 행을 지우기 전에 이 회원의 사진 주소를 모아 둠 → 다 지운 뒤 아무도 안 쓰는 파일만 커밋 후 삭제
        List<String> images = new ArrayList<>();
        for (String[] r : ImageCleanupService.REFERENCES) {
            images.addAll(jdbc.queryForList("SELECT " + r[1] + " FROM " + r[0] + " WHERE member_id = ? AND " + r[1] + " IS NOT NULL",
                    String.class, memberId));
        }
        int rows = 0;
        for (String[] c : CHILD_TABLES) {
            rows += jdbc.update("DELETE FROM " + c[0] + " WHERE " + c[1] + " IN (" + c[2] + ")", memberId);
        }
        for (String t : MEMBER_TABLES) {
            rows += jdbc.update("DELETE FROM " + t + " WHERE member_id = ?", memberId);
        }
        jdbc.update("DELETE FROM member WHERE id = ?", memberId);
        imageCleanup.deleteUnreferencedAfterCommit(images);
        log.info("탈퇴 회원 {} 데이터 삭제 — {}행, 사진 주소 {}개 정리 대상", memberId, rows, images.size());
    }
}
