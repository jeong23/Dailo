package com.dailo.app.service;

import com.dailo.app.service.CashFlow.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// 현금 잔액 = 기준 잔액 + 기준 시각 이후 현금 지출·수입 + 카드값(정산월 끝) + 다음 달부터 월급−고정비
class CashFlowTest {

    private static final LocalDateTime AS_OF = LocalDateTime.of(2026, 11, 2, 12, 0);
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 10);
    private static final String NOV = "2026-11";

    private static Anchor acc(long id, long balance) {
        return new Anchor(id, true, balance, AS_OF, NOV);
    }

    private static Event cash(Long acc, long amount, LocalDate date, String month) {
        return new Event(acc, amount, date, date.atTime(9, 0), month, false);
    }

    private static Event card(long amount, LocalDate date, String month) {
        return new Event(null, -amount, date, date.atTime(9, 0), month, true);
    }

    @Test
    void 기준_시각_이후_현금_지출과_수입만_반영() {
        var r = CashFlow.calculate(List.of(acc(1, 1_000_000)), List.of(
                cash(null, -30_000, LocalDate.of(2026, 11, 1), NOV),   // 기준일 전 — 이미 잔액에 있음
                cash(null, -20_000, LocalDate.of(2026, 11, 5), NOV),
                cash(null, 50_000, LocalDate.of(2026, 11, 6), NOV)
        ), List.of(), NOV, TODAY);
        assertThat(r.accounts().get(1L).current()).isEqualTo(1_030_000);
        assertThat(r.monthEnd()).containsEntry(NOV, 1_030_000L);
    }

    @Test
    void 기준일_당일은_등록_시각으로_판단() {
        LocalDate day = AS_OF.toLocalDate();
        var r = CashFlow.calculate(List.of(acc(1, 100_000)), List.of(
                new Event(null, -1_000, day, AS_OF.minusHours(1), NOV, false),
                new Event(null, -2_000, day, AS_OF.plusHours(1), NOV, false)
        ), List.of(), NOV, TODAY);
        assertThat(r.accounts().get(1L).current()).isEqualTo(98_000);
    }

    @Test
    void 카드값은_정산월이_끝나야_빠짐_기준일_전_사용분도_포함() {
        var events = List.of(card(40_000, LocalDate.of(2026, 10, 30), NOV), card(10_000, LocalDate.of(2026, 11, 8), NOV));
        var r = CashFlow.calculate(List.of(acc(1, 500_000)), events, List.of(), NOV, TODAY);
        assertThat(r.accounts().get(1L).current()).isEqualTo(500_000);
        assertThat(r.accounts().get(1L).pendingCard()).isEqualTo(50_000);
        assertThat(r.monthEnd()).containsEntry(NOV, 450_000L);

        // 다음 달이 되면 11월 카드값이 빠지고, 12월 월급−고정비가 들어옴
        var dec = CashFlow.calculate(List.of(acc(1, 500_000)), events,
                List.of(new MonthlyFlow("2026-12", 3_000_000, 800_000)), "2026-12", LocalDate.of(2026, 12, 1));
        assertThat(dec.accounts().get(1L).current()).isEqualTo(500_000 - 50_000 + 2_200_000);
        assertThat(dec.monthEnd()).containsEntry(NOV, 450_000L).containsEntry("2026-12", 2_650_000L);
    }

    @Test
    void 기준_잔액_달_월급은_이미_반영된_걸로_봄() {
        var r = CashFlow.calculate(List.of(acc(1, 0)), List.of(),
                List.of(new MonthlyFlow(NOV, 3_000_000, 0)), NOV, TODAY);
        assertThat(r.accounts().get(1L).current()).isZero();
    }

    @Test
    void 계좌_지정_없거나_지운_계좌면_기본_계좌로_월급은_기본_계좌에만() {
        var off = new Anchor(9L, false, 700_000, AS_OF, NOV);
        var r = CashFlow.calculate(List.of(off, acc(1, 100_000), acc(2, 200_000)), List.of(
                cash(2L, -5_000, LocalDate.of(2026, 11, 3), NOV),
                cash(77L, -1_000, LocalDate.of(2026, 11, 3), NOV),
                cash(null, -2_000, LocalDate.of(2026, 11, 3), NOV)
        ), List.of(new MonthlyFlow("2026-12", 1_000_000, 0)), "2026-12", LocalDate.of(2026, 12, 1));
        assertThat(r.accounts().get(1L).current()).isEqualTo(100_000 - 3_000 + 1_000_000);
        assertThat(r.accounts().get(2L).current()).isEqualTo(195_000);
        assertThat(r.accounts().get(9L).current()).isEqualTo(700_000);
        // 꺼진 계좌는 합계에서 빠짐
        assertThat(r.monthEnd()).containsEntry("2026-12", 1_292_000L);
    }

    @Test
    void 달별_잔액은_켜진_계좌_모두_기준이_있는_달부터() {
        var older = new Anchor(1L, true, 100, AS_OF.minusMonths(2), "2026-09");
        var r = CashFlow.calculate(List.of(older, acc(2, 200)), List.of(), List.of(), NOV, TODAY);
        assertThat(r.monthEnd()).containsOnlyKeys(NOV);
    }

    @Test
    void 적금_납입일_말일_보정과_정산월() {
        // 1월 31일 시작 6개월 → 2월은 28일, 월급일 25일이면 1/31은 2월 정산월
        var pays = CashFlow.savingsPayments(LocalDate.of(2026, 1, 31), 100_000, 6, 25, LocalDate.of(2026, 1, 1), "2026-12", Set.of());
        assertThat(pays).extracting(Event::date).containsExactly(
                LocalDate.of(2026, 1, 31), LocalDate.of(2026, 2, 28), LocalDate.of(2026, 3, 31),
                LocalDate.of(2026, 4, 30), LocalDate.of(2026, 5, 31), LocalDate.of(2026, 6, 30));
        assertThat(pays.get(0).month()).isEqualTo("2026-02");
        assertThat(pays.get(1).month()).isEqualTo("2026-03");
        assertThat(pays).allMatch(e -> e.amount() == -100_000 && !e.card());
    }

    @Test
    void 청약은_만기_없이_정산월까지_from_이후만() {
        var pays = CashFlow.savingsPayments(LocalDate.of(2025, 5, 10), 250_000, null, 25, LocalDate.of(2026, 11, 2), NOV, Set.of());
        assertThat(pays).extracting(Event::date).containsExactly(LocalDate.of(2026, 11, 10));
    }

    @Test
    void 적금_납입은_기준일_이후_납입일에_현금에서_빠짐() {
        var pays = CashFlow.savingsPayments(LocalDate.of(2026, 6, 5), 300_000, 12, 25, AS_OF.toLocalDate().minusDays(1), "2026-12", Set.of());
        // 11/2 기준 → 12/5 납입(12월 정산월)만, 11/5는 미래가 아니라 기준 이후 → 11월 정산월
        var r = CashFlow.calculate(List.of(acc(1, 1_000_000)), pays, List.of(), "2026-12", LocalDate.of(2026, 12, 1));
        assertThat(r.accounts().get(1L).current()).isEqualTo(700_000);       // 11/5만 지남
        assertThat(r.monthEnd()).containsEntry(NOV, 700_000L).containsEntry("2026-12", 400_000L);
    }

    @Test
    void 납입_지출이_적힌_달은_자동_납입_안_만듦() {
        // 11/5, 12/5 납입 예정 — 11월은 지출로 적었으니 12월 것만
        var pays = CashFlow.savingsPayments(LocalDate.of(2026, 6, 5), 300_000, 12, 25,
                LocalDate.of(2026, 11, 1), "2026-12", Set.of("2026-11"));
        assertThat(pays).extracting(Event::date).containsExactly(LocalDate.of(2026, 12, 5));
    }

    @Test
    void 적금_만기_수령액이_만기일에_들어옴() {
        // 월 30만 × 12개월, 연 3.5%, 일반과세: 이자 = floor(300000 × 0.035 × 78 / 12) = 68,250 → 세금 10,510 → 3,657,740
        var pay = CashFlow.maturityPayout(LocalDate.of(2025, 11, 5), 300_000, 12, 3.5, false, 0, null, 25,
                LocalDate.of(2026, 11, 1), NOV);
        assertThat(pay).get().extracting(Event::date, Event::amount).containsExactly(LocalDate.of(2026, 11, 5), 3_657_740L);
        // 기준 이전에 만기면 없음 (이미 받은 돈은 기준 잔액에 있음)
        assertThat(CashFlow.maturityPayout(LocalDate.of(2025, 11, 5), 300_000, 12, 3.5, false, 0, null, 25,
                LocalDate.of(2026, 11, 10), "2026-12")).isEmpty();
    }

    @Test
    void 만기_수령액_비과세_정부기여금() {
        // 비과세 + 기여금 월 3만 × 12 = 36만 (적립액 입력이 더 크면 그 값)
        assertThat(CashFlow.maturityAmount(300_000, 12, 3.5, true, 30_000, null)).isEqualTo(3_600_000 + 68_250 + 360_000);
        assertThat(CashFlow.maturityAmount(300_000, 12, 3.5, true, 30_000, 400_000L)).isEqualTo(3_600_000 + 68_250 + 400_000);
    }
}
