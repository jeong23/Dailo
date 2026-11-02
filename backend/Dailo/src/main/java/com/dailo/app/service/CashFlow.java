package com.dailo.app.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;

// 현금 계좌 잔액 계산 (순수 계산 — DB 없음, 테스트 CashFlowTest)
//  잔액 = 기준 잔액(사용자가 확인한 값) + 기준 시각 이후 기록
//   · 현금·이체 지출 / 수입: 날짜가 기준 시각 이후면 그날 반영 (기준일 당일은 등록 시각으로 판단)
//   · 카드 지출: 그 정산월이 끝날 때 한 번에 빠짐 — 기준 잔액 달과 그 뒤 달 카드값만 (이전 달 카드값은 이미 결제됨)
//   · 월급(실수령액)·고정비: 정산월이 시작할 때 — 기준 잔액 달은 이미 반영된 걸로 보고 그다음 달부터, 기본 계좌에만
//   · 적금 만기: 만기일(시작일 + 기간)에 세후 만기 수령액(maturityPayout)이 들어옴 — 기본 계좌로. 청약은 만기 없음
//   · 적금·청약 납입: 매달 납입일(savingsPayments)에 현금·이체 지출처럼 — 기본 계좌에서. 그 정산월에 납입 지출(savingsId)이 있으면 그 기록이 대신
//  계좌가 지정 안 됐거나 지워진 계좌의 기록은 기본 계좌(켜진 계좌 중 첫 번째)로
public final class CashFlow {

    private CashFlow() {}

    public record Anchor(Long accountId, boolean on, long balance, LocalDateTime asOf, String month) {}

    // amount: 들어오면 +, 나가면 −
    public record Event(Long accountId, long amount, LocalDate date, LocalDateTime createdAt, String month, boolean card) {}

    // 정산월 시작 시 들어오고 나가는 돈 (월급 − 고정비)
    public record MonthlyFlow(String month, long salary, long fixedCost) {}

    public record AccountBalance(long current, long pendingCard) {}

    public record Result(Map<Long, AccountBalance> accounts, Map<String, Long> monthEnd) {
        public static Result empty() { return new Result(Map.of(), Map.of()); }
    }

    // anchors는 계좌 정렬 순서대로 (기본 계좌 판정)
    public static Result calculate(List<Anchor> anchors, List<Event> events, List<MonthlyFlow> monthly,
                                   String currentMonth, LocalDate today) {
        if (anchors.isEmpty()) return Result.empty();
        Long defaultId = anchors.stream().filter(Anchor::on).findFirst().orElse(anchors.get(0)).accountId();
        Set<Long> ids = new HashSet<>();
        anchors.forEach(a -> ids.add(a.accountId()));

        Map<Long, List<Event>> byAccount = new HashMap<>();
        for (Event e : events) {
            Long id = e.accountId() != null && ids.contains(e.accountId()) ? e.accountId() : defaultId;
            byAccount.computeIfAbsent(id, k -> new ArrayList<>()).add(e);
        }

        Map<Long, AccountBalance> accounts = new LinkedHashMap<>();
        for (Anchor a : anchors) {
            List<Event> mine = byAccount.getOrDefault(a.accountId(), List.of());
            boolean isDefault = Objects.equals(a.accountId(), defaultId);
            long current = a.balance();
            long pending = 0;
            for (Event e : mine) {
                if (e.card()) {
                    if (e.month().compareTo(a.month()) < 0) continue;
                    if (e.month().compareTo(currentMonth) < 0) current += e.amount();
                    else pending += -e.amount();
                } else if (after(e, a) && !e.date().isAfter(today)) {
                    current += e.amount();
                }
            }
            if (isDefault) current += monthlyBetween(monthly, a.month(), currentMonth);
            accounts.put(a.accountId(), new AccountBalance(current, pending));
        }

        // 달별 말 잔액 — 켜진 계좌 모두 기준 잔액이 있는 달부터 (그 전 달은 저장된 기록을 씀)
        Map<String, Long> monthEnd = new LinkedHashMap<>();
        Optional<String> start = anchors.stream().filter(Anchor::on).map(Anchor::month).max(Comparator.naturalOrder());
        if (start.isPresent() && start.get().compareTo(currentMonth) <= 0) {
            for (YearMonth ym = YearMonth.parse(start.get()); !ym.isAfter(YearMonth.parse(currentMonth)); ym = ym.plusMonths(1)) {
                String m = ym.toString();
                long total = 0;
                for (Anchor a : anchors) {
                    if (!a.on()) continue;
                    total += balanceAtMonthEnd(a, byAccount.getOrDefault(a.accountId(), List.of()),
                            Objects.equals(a.accountId(), defaultId), monthly, m);
                }
                monthEnd.put(m, total);
            }
        }
        return new Result(accounts, monthEnd);
    }

    // 그 정산월 말 — 그 달 카드값, 미래 날짜로 적어둔 그 달 기록까지 포함
    private static long balanceAtMonthEnd(Anchor a, List<Event> mine, boolean isDefault, List<MonthlyFlow> monthly, String m) {
        long sum = a.balance();
        for (Event e : mine) {
            if (e.month().compareTo(m) > 0) continue;
            if (e.card() ? e.month().compareTo(a.month()) >= 0 : after(e, a)) sum += e.amount();
        }
        if (isDefault) sum += monthlyBetween(monthly, a.month(), m);
        return sum;
    }

    // (from, to] 달의 월급 − 고정비
    private static long monthlyBetween(List<MonthlyFlow> monthly, String from, String to) {
        long sum = 0;
        for (MonthlyFlow f : monthly) {
            if (f.month().compareTo(from) > 0 && f.month().compareTo(to) <= 0) sum += f.salary() - f.fixedCost();
        }
        return sum;
    }

    // 적금·청약 납입 이벤트 — 시작일과 같은 날 매달(말일 보정, plusMonths가 처리), months 0·null = 만기 없음(청약)
    //  from 다음 날부터 정산월 untilMonth까지만. createdAt null → 기준일 당일 납입은 이미 잔액에 있는 걸로 봄
    //  recorded: 납입 지출이 적힌 정산월 — 그 달은 지출 기록이 대신 빠지므로 자동 납입을 만들지 않음 (두 번 빠짐 방지)
    public static List<Event> savingsPayments(LocalDate start, long monthly, Integer months, int salaryDay,
                                              LocalDate from, String untilMonth, Set<String> recorded) {
        List<Event> out = new ArrayList<>();
        if (start == null || monthly <= 0) return out;
        int limit = months == null || months <= 0 ? Integer.MAX_VALUE : months;
        for (int n = 0; n < limit; n++) {
            LocalDate d = start.plusMonths(n);
            String month = settleMonthOf(d, salaryDay);
            if (month.compareTo(untilMonth) > 0) break;
            if (d.isAfter(from) && !recorded.contains(month)) out.add(new Event(null, -monthly, d, null, month, false));
        }
        return out;
    }

    // 적금 만기 수령 — 프론트 utils/savings.ts savingsSummary.maturityAmount와 같은 계산
    //  원금(월납 × 기간) + 단리 이자(월납 × 이율 × n(n+1)/2 ÷ 12, 원 미만 버림) − 이자소득세 15.4%(10원 미만 버림, 비과세면 0) + 정부기여금
    //  만기일이 from 다음 날부터 정산월 untilMonth 안일 때만
    public static Optional<Event> maturityPayout(LocalDate start, long monthly, int months, double ratePct, boolean taxFree,
                                                 long monthlyBonus, Long bonusBalance, int salaryDay, LocalDate from, String untilMonth) {
        if (start == null || monthly <= 0 || months <= 0) return Optional.empty();
        LocalDate d = start.plusMonths(months);
        String month = settleMonthOf(d, salaryDay);
        if (!d.isAfter(from) || month.compareTo(untilMonth) > 0) return Optional.empty();
        return Optional.of(new Event(null, maturityAmount(monthly, months, ratePct, taxFree, monthlyBonus, bonusBalance), d, null, month, false));
    }

    static long maturityAmount(long monthly, int months, double ratePct, boolean taxFree, long monthlyBonus, Long bonusBalance) {
        long gross = (long) Math.floor(monthly * (ratePct / 100) * ((long) months * (months + 1)) / 2 / 12);
        long tax = taxFree ? 0 : (long) Math.floor(gross * 0.154 / 10) * 10;
        long bonus = Math.max(monthlyBonus * months, bonusBalance != null ? bonusBalance : 0);
        return monthly * months + gross - tax + bonus;
    }

    // 프론트 getSettleMonthForDate와 같은 규칙 — 월급일 이후면 다음 달 정산월
    public static String settleMonthOf(LocalDate d, int salaryDay) {
        YearMonth ym = YearMonth.from(d);
        return (d.getDayOfMonth() >= salaryDay ? ym.plusMonths(1) : ym).toString();
    }

    private static boolean after(Event e, Anchor a) {
        LocalDate day = a.asOf().toLocalDate();
        if (e.date().isAfter(day)) return true;
        return e.date().isEqual(day) && e.createdAt() != null && e.createdAt().isAfter(a.asOf());
    }
}
