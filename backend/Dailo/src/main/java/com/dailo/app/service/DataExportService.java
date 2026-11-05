package com.dailo.app.service;

import com.dailo.app.dto.DataExportDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAccessor;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.io.OutputStreamWriter;

// 내 데이터 내보내기 — 사용자가 고른 묶음만 CSV(엑셀용 UTF-8 BOM)로 묶어 ZIP 하나로.
// 모든 SQL은 여기 상수로만 존재하고 파라미터는 로그인 memberId 하나 (요청 값은 묶음 key로만 받아 화이트리스트 확인).
// 새 회원 데이터 테이블을 만들면 MemberPurgeService와 여기 둘 다 추가 — DataExportServiceTest가 누락을 잡음
@Service
@RequiredArgsConstructor
public class DataExportService {

    // table = 원본 테이블(누락 검사용), file = ZIP 안 경로, sql = 이 회원 행만 고르는 쿼리 (? = memberId)
    record Sheet(String table, String file, String sql) {}

    record Group(String key, String label, String description, List<Sheet> sheets) {}

    static final List<Group> GROUPS = List.of(
            new Group("ledger", "가계부", "지출·수입·고정비·월별 예산", List.of(
                    new Sheet("daily_expense", "가계부/지출.csv",
                            "SELECT e.*, c.name AS category_name FROM daily_expense e " +
                                    "JOIN monthly_budget b ON e.monthly_budget_id = b.id " +
                                    "LEFT JOIN category c ON e.category_id = c.id " +
                                    "WHERE b.member_id = ? ORDER BY e.expense_date, e.id"),
                    new Sheet("income", "가계부/수입.csv",
                            "SELECT * FROM income WHERE member_id = ? ORDER BY income_date, id"),
                    new Sheet("fixed_cost", "가계부/고정비.csv",
                            "SELECT * FROM fixed_cost WHERE member_id = ? ORDER BY sort_order, id"),
                    new Sheet("monthly_budget", "가계부/월별_예산.csv",
                            "SELECT * FROM monthly_budget WHERE member_id = ? ORDER BY settle_month"),
                    new Sheet("budget_allocation_item", "가계부/예산_항목.csv",
                            "SELECT b.settle_month, i.* FROM budget_allocation_item i " +
                                    "JOIN monthly_budget b ON i.monthly_budget_id = b.id " +
                                    "WHERE b.member_id = ? ORDER BY b.settle_month, i.sort_order, i.id"))),
            new Group("assets", "현금·적금", "현금 계좌·달별 현금 자산·적금·청약·자산 배분·순자산 추이", List.of(
                    new Sheet("cash_account", "현금_적금/현금_계좌.csv",
                            "SELECT * FROM cash_account WHERE member_id = ? ORDER BY sort_order, id"),
                    new Sheet("cash_asset", "현금_적금/현금_자산_추이.csv",
                            "SELECT * FROM cash_asset WHERE member_id = ? ORDER BY settle_month"),
                    new Sheet("savings", "현금_적금/적금_청약.csv",
                            "SELECT * FROM savings WHERE member_id = ? ORDER BY start_date, id"),
                    new Sheet("asset_bucket", "현금_적금/자산_배분.csv",
                            "SELECT * FROM asset_bucket WHERE member_id = ? ORDER BY sort_order, id"),
                    new Sheet("asset_snapshot", "현금_적금/순자산_추이.csv",
                            "SELECT * FROM asset_snapshot WHERE member_id = ? ORDER BY settle_month"))),
            new Group("invest", "투자", "계좌·종목·월별 기록·체결 내역·테마·설정·투자일기", List.of(
                    new Sheet("invest_account", "투자/계좌.csv",
                            "SELECT * FROM invest_account WHERE member_id = ? ORDER BY sort_order, id"),
                    new Sheet("invest_holding", "투자/종목.csv",
                            "SELECT a.name AS account_name, h.* FROM invest_holding h " +
                                    "JOIN invest_account a ON h.account_id = a.id " +
                                    "WHERE a.member_id = ? ORDER BY a.sort_order, h.sort_order, h.id"),
                    new Sheet("invest_monthly_record", "투자/월별_기록.csv",
                            "SELECT a.name AS account_name, h.ticker, r.* FROM invest_monthly_record r " +
                                    "JOIN invest_holding h ON r.holding_id = h.id " +
                                    "JOIN invest_account a ON h.account_id = a.id " +
                                    "WHERE a.member_id = ? ORDER BY r.`year_month`, r.id"),
                    new Sheet("invest_trade", "투자/체결_내역.csv",
                            "SELECT * FROM invest_trade WHERE member_id = ? ORDER BY trade_date, id"),
                    new Sheet("invest_theme", "투자/테마.csv",
                            "SELECT * FROM invest_theme WHERE member_id = ? ORDER BY sort_order, id"),
                    new Sheet("invest_setting", "투자/설정.csv",
                            "SELECT * FROM invest_setting WHERE member_id = ?"),
                    new Sheet("invest_diary", "투자/투자일기.csv",
                            "SELECT * FROM invest_diary WHERE member_id = ? ORDER BY `date`, id"))),
            new Group("planner", "플래너", "오늘 플래너·할 일·타임박스·미래 시각화(사진 주소)", List.of(
                    new Sheet("daily_plan", "플래너/하루_플랜.csv",
                            "SELECT * FROM daily_plan WHERE member_id = ? ORDER BY plan_date"),
                    new Sheet("todo_item", "플래너/할_일.csv",
                            "SELECT * FROM todo_item WHERE member_id = ? ORDER BY plan_date, type, sort_order, id"),
                    new Sheet("time_box_slot", "플래너/타임박스_칸.csv",
                            "SELECT * FROM time_box_slot WHERE member_id = ? ORDER BY plan_date, hour"),
                    new Sheet("time_box_block", "플래너/타임박스_블록.csv",
                            "SELECT * FROM time_box_block WHERE member_id = ? ORDER BY plan_date, start_hour, start_slot"),
                    new Sheet("vision_board_item", "플래너/미래_시각화_보드.csv",
                            "SELECT * FROM vision_board_item WHERE member_id = ? ORDER BY z, id"))),
            new Group("habit", "습관", "습관 목록·체크 기록", List.of(
                    new Sheet("habit", "습관/습관.csv",
                            "SELECT * FROM habit WHERE member_id = ? ORDER BY sort_order, id"),
                    new Sheet("habit_log", "습관/체크_기록.csv",
                            "SELECT h.name AS habit_name, l.* FROM habit_log l JOIN habit h ON l.habit_id = h.id " +
                                    "WHERE h.member_id = ? ORDER BY l.log_date, h.sort_order"))),
            new Group("workout", "운동", "러닝 기록·목표, 웨이트 기록·세트·루틴·즐겨찾기", List.of(
                    new Sheet("running_record", "운동/러닝_기록.csv",
                            "SELECT * FROM running_record WHERE member_id = ? ORDER BY run_date, id"),
                    new Sheet("running_goal", "운동/러닝_목표.csv",
                            "SELECT * FROM running_goal WHERE member_id = ? ORDER BY year, month"),
                    new Sheet("workout_log", "운동/웨이트_기록.csv",
                            "SELECT * FROM workout_log WHERE member_id = ? ORDER BY workout_date, id"),
                    new Sheet("workout_set", "운동/웨이트_세트.csv",
                            "SELECT w.workout_date, s.* FROM workout_set s JOIN workout_log w ON s.workout_log_id = w.id " +
                                    "WHERE w.member_id = ? ORDER BY w.workout_date, s.exercise_sort_order, s.set_number"),
                    new Sheet("workout_routine", "운동/루틴.csv",
                            "SELECT * FROM workout_routine WHERE member_id = ? ORDER BY sort_order, id"),
                    new Sheet("workout_routine_exercise", "운동/루틴_종목.csv",
                            "SELECT r.name AS routine_name, e.* FROM workout_routine_exercise e " +
                                    "JOIN workout_routine r ON e.routine_id = r.id " +
                                    "WHERE r.member_id = ? ORDER BY r.sort_order, e.sort_order"),
                    new Sheet("workout_bookmark", "운동/즐겨찾기.csv",
                            "SELECT * FROM workout_bookmark WHERE member_id = ? ORDER BY id"))),
            new Group("profile", "회원 정보·메모", "아이디·이름·월급일, 달별 메모 (비밀번호는 넣지 않음)", List.of(
                    // password·role·deleted_at 제외 — 파일이 유출돼도 로그인 정보는 안 나가게
                    new Sheet("member", "회원/회원_정보.csv",
                            "SELECT id, username, name, salary_day, salary_gross, created_at FROM member WHERE id = ?"),
                    new Sheet("member_note", "회원/메모.csv",
                            "SELECT * FROM member_note WHERE member_id = ? ORDER BY note_key")))
    );

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final byte[] BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    private final JdbcTemplate jdbc;

    // 체크 목록용 — 묶음마다 행 수
    @Transactional(readOnly = true)
    public List<DataExportDto.Item> items(Long memberId) {
        List<DataExportDto.Item> result = new ArrayList<>();
        for (Group g : GROUPS) {
            long rows = 0;
            for (Sheet s : g.sheets()) {
                Long n = jdbc.queryForObject("SELECT COUNT(*) FROM (" + s.sql() + ") x", Long.class, memberId);
                rows += n == null ? 0 : n;
            }
            result.add(new DataExportDto.Item(g.key(), g.label(), g.description(), rows));
        }
        return result;
    }

    // 고른 묶음의 CSV + 안내 파일을 ZIP으로. 모르는 key면 400
    @Transactional(readOnly = true)
    public byte[] export(Long memberId, Collection<String> keys) {
        List<Group> chosen = resolve(keys);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        Map<String, Integer> counts = new LinkedHashMap<>();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            for (Group g : chosen) {
                for (Sheet s : g.sheets()) {
                    zip.putNextEntry(new ZipEntry(s.file()));
                    zip.write(BOM);
                    Writer out = new OutputStreamWriter(zip, StandardCharsets.UTF_8);
                    int[] rows = {0};
                    boolean[] header = {false};
                    jdbc.query(s.sql(), rs -> {
                        if (!header[0]) { writeHeader(out, rs.getMetaData()); header[0] = true; }
                        writeRow(out, rs);
                        rows[0]++;
                    }, memberId);
                    if (!header[0]) writeEmptyHeader(out, s);
                    out.flush(); // zip을 닫지 않게 Writer는 close하지 않음
                    zip.closeEntry();
                    counts.put(s.file(), rows[0]);
                }
            }
            zip.putNextEntry(new ZipEntry("읽어주세요.txt"));
            zip.write(readme(chosen, counts).getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    static List<Group> resolve(Collection<String> keys) {
        if (keys == null || keys.isEmpty()) throw new IllegalArgumentException("내보낼 항목을 하나 이상 골라주세요");
        Set<String> wanted = new HashSet<>();
        for (String k : keys) {
            String key = k == null ? "" : k.trim();
            if (key.isEmpty()) continue;
            if (GROUPS.stream().noneMatch(g -> g.key().equals(key))) throw new IllegalArgumentException("알 수 없는 항목: " + key);
            wanted.add(key);
        }
        if (wanted.isEmpty()) throw new IllegalArgumentException("내보낼 항목을 하나 이상 골라주세요");
        return GROUPS.stream().filter(g -> wanted.contains(g.key())).toList(); // 화면 순서와 같게
    }

    private static void writeHeader(Writer out, ResultSetMetaData meta) throws SQLException {
        List<String> cols = new ArrayList<>();
        for (int i = 1; i <= meta.getColumnCount(); i++) cols.add(meta.getColumnLabel(i));
        line(out, cols);
    }

    // 행이 없어도 열 이름은 남김 — 빈 파일보다 어떤 칸이 있는지 보이는 게 낫다
    private void writeEmptyHeader(Writer out, Sheet s) {
        jdbc.query("SELECT * FROM (" + s.sql() + ") x LIMIT 0", (ResultSet rs) -> {
            writeHeader(out, rs.getMetaData());
            return null;
        }, 0L);
    }

    private static void writeRow(Writer out, ResultSet rs) throws SQLException {
        int n = rs.getMetaData().getColumnCount();
        List<String> cells = new ArrayList<>(n);
        for (int i = 1; i <= n; i++) cells.add(cell(rs.getObject(i)));
        line(out, cells);
    }

    private static void line(Writer out, List<String> cells) {
        try {
            out.write(String.join(",", cells));
            out.write("\r\n"); // 엑셀 기본 줄바꿈
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // CSV 한 칸: 날짜는 읽기 좋게, 숫자는 지수 표기 없이, 글자는 따옴표 이스케이프 + 수식 주입 방지
    static String cell(Object v) {
        if (v == null) return "";
        if (v instanceof java.sql.Timestamp t) return t.toLocalDateTime().format(DATE_TIME);
        if (v instanceof LocalDateTime t) return t.format(DATE_TIME);
        if (v instanceof java.sql.Date d) return d.toLocalDate().toString();
        if (v instanceof TemporalAccessor t) return t.toString();
        if (v instanceof BigDecimal d) return d.stripTrailingZeros().toPlainString();
        if (v instanceof Number || v instanceof Boolean) return v.toString();
        if (v instanceof byte[] b) return b.length == 1 ? (b[0] != 0 ? "true" : "false") : ""; // BIT(1)
        String s = v.toString();
        // 엑셀이 =, +, -, @ 로 시작하는 글자를 수식으로 실행함 (메모·종목명에 사용자가 넣은 값) → 앞에 ' 붙여 글자로
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0) s = "'" + s;
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            s = "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    private static String readme(List<Group> chosen, Map<String, Integer> counts) {
        StringBuilder sb = new StringBuilder();
        sb.append("Dailo 데이터 내보내기\r\n");
        sb.append("내보낸 시각: ").append(LocalDateTime.now().format(DATE_TIME)).append("\r\n\r\n");
        for (Group g : chosen) {
            sb.append("[").append(g.label()).append("]\r\n");
            for (Sheet s : g.sheets()) {
                sb.append("  ").append(s.file()).append(" — ").append(counts.getOrDefault(s.file(), 0)).append("행\r\n");
            }
        }
        sb.append("\r\n");
        sb.append("- CSV는 UTF-8이라 엑셀에서 바로 열면 한글이 보여요.\r\n");
        sb.append("- 금액은 원 단위, 비율(rate)은 소수(0.35 = 35%)예요.\r\n");
        sb.append("- 사진은 파일이 아니라 주소(image_url)만 들어 있어요.\r\n");
        sb.append("- 비밀번호는 넣지 않았어요. 이 파일에는 금융 기록이 있으니 안전한 곳에 보관하세요.\r\n");
        return sb.toString();
    }
}
