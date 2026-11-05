package com.dailo.app.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DataExportServiceTest {

    private static Set<String> exportedTables() {
        return DataExportService.GROUPS.stream().flatMap(g -> g.sheets().stream())
                .map(DataExportService.Sheet::table).collect(Collectors.toSet());
    }

    @Test
    void 삭제_대상_회원_테이블은_모두_내보내기에_있다() {
        // 탈퇴 파기 목록 = 회원 데이터 전체 (MemberPurgeServiceTest가 엔티티 스캔으로 보장)
        Set<String> memberData = new HashSet<>(MemberPurgeService.MEMBER_TABLES);
        MemberPurgeService.CHILD_TABLES.forEach(c -> memberData.add(c[0]));
        memberData.add("member");

        Set<String> missing = new HashSet<>(memberData);
        missing.removeAll(exportedTables());
        assertThat(missing).as("내보내기에 없는 회원 테이블").isEmpty();
    }

    @Test
    void 모든_쿼리는_memberId_파라미터_하나로만_거른다() {
        for (DataExportService.Group g : DataExportService.GROUPS) {
            for (DataExportService.Sheet s : g.sheets()) {
                long params = s.sql().chars().filter(ch -> ch == '?').count();
                assertThat(params).as(s.file()).isEqualTo(1);
                assertThat(s.sql()).as(s.file()).containsPattern("(member_id|\\bid) = \\?");
            }
        }
    }

    @Test
    void 회원_정보에는_비밀번호가_없다() {
        String sql = DataExportService.GROUPS.stream().flatMap(g -> g.sheets().stream())
                .filter(s -> s.table().equals("member")).findFirst().orElseThrow().sql();
        assertThat(sql).doesNotContain("password").doesNotContain("*");
    }

    @Test
    void 묶음_key와_파일_이름은_겹치지_않는다() {
        List<String> keys = DataExportService.GROUPS.stream().map(DataExportService.Group::key).toList();
        assertThat(keys).doesNotHaveDuplicates();
        List<String> files = DataExportService.GROUPS.stream().flatMap(g -> g.sheets().stream())
                .map(DataExportService.Sheet::file).toList();
        assertThat(files).doesNotHaveDuplicates();
    }

    @Test
    void 모르는_key나_빈_선택은_거절한다() {
        assertThatThrownBy(() -> DataExportService.resolve(List.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DataExportService.resolve(List.of(" "))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DataExportService.resolve(List.of("ledger", "member; DROP TABLE x")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DataExportService.resolve(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 고른_묶음만_화면_순서대로() {
        assertThat(DataExportService.resolve(List.of("invest", "ledger")))
                .extracting(DataExportService.Group::key).containsExactly("ledger", "invest");
    }

    @Test
    void CSV_칸_이스케이프() {
        assertThat(DataExportService.cell(null)).isEmpty();
        assertThat(DataExportService.cell("점심, 김밥")).isEqualTo("\"점심, 김밥\"");
        assertThat(DataExportService.cell("그가 \"좋다\"")).isEqualTo("\"그가 \"\"좋다\"\"\"");
        assertThat(DataExportService.cell("첫 줄\n둘째 줄")).isEqualTo("\"첫 줄\n둘째 줄\"");
        assertThat(DataExportService.cell(new BigDecimal("0.3500"))).isEqualTo("0.35");
        assertThat(DataExportService.cell(new BigDecimal("1E+3"))).isEqualTo("1000");
        assertThat(DataExportService.cell(-15000L)).isEqualTo("-15000"); // 숫자 음수는 그대로
        assertThat(DataExportService.cell(Timestamp.valueOf(LocalDateTime.of(2026, 11, 5, 9, 3, 7)))).isEqualTo("2026-11-05 09:03:07");
        assertThat(DataExportService.cell(java.sql.Date.valueOf("2026-11-05"))).isEqualTo("2026-11-05");
        assertThat(DataExportService.cell(true)).isEqualTo("true");
    }

    @Test
    void 엑셀_수식으로_실행될_글자는_막는다() {
        assertThat(DataExportService.cell("=HYPERLINK(\"http://x\")")).startsWith("\"'=");
        assertThat(DataExportService.cell("+1")).isEqualTo("'+1");
        assertThat(DataExportService.cell("-환불")).isEqualTo("'-환불");
        assertThat(DataExportService.cell("@sum")).isEqualTo("'@sum");
        assertThat(DataExportService.cell("커피")).isEqualTo("커피");
    }
}
