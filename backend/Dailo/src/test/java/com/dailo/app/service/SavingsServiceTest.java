package com.dailo.app.service;

import com.dailo.app.dto.SavingsDto;
import com.dailo.app.entity.Savings;
import com.dailo.app.repository.DailyExpenseRepository;
import com.dailo.app.repository.SavingsRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SavingsServiceTest {

    private final SavingsRepository repo = mock(SavingsRepository.class);
    private final SavingsService service = new SavingsService(repo, mock(DailyExpenseRepository.class), mock(CashAccountService.class));

    private SavingsDto.Request req(Long monthly, Integer months, Integer paid) {
        return new SavingsDto.Request("청년도약", "IBK", monthly, LocalDate.of(2026, 1, 25), months, 4.5f, false, paid, null, null, null, null, null, null, null);
    }

    private SavingsDto.Request housing(Integer paid, Long balance, String region) {
        return new SavingsDto.Request("주택청약종합저축", "우리", 100_000L, LocalDate.of(2020, 3, 10), null, 0.5f, false, paid, null,
                "HOUSING", balance, region, true, 60_000L, 180_000L);
    }

    @Test
    void 다른_회원의_적금은_수정_삭제할_수_없다() {
        Savings other = mock(Savings.class);
        when(other.getMemberId()).thenReturn(2L);
        when(repo.findById(5L)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.update(1L, 5L, req(300_000L, 12, null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.delete(1L, 5L)).isInstanceOf(IllegalArgumentException.class);
        verify(other, never()).update(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(repo, never()).delete(any());
    }

    @Test
    void 잘못된_값은_거절() {
        assertThatThrownBy(() -> SavingsService.validate(req(0L, 12, null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SavingsService.validate(req(100_000L, 0, null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SavingsService.validate(req(100_000L, 12, 13))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 청약은_기간_없이_저장되고_만기_관련_값은_비운다() {
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        SavingsDto.Response r = service.create(1L, housing(80, 8_000_000L, "SEOUL_BUSAN"));
        assertThat(r.getKind()).isEqualTo("HOUSING");
        assertThat(r.getMonths()).isZero();
        assertThat(r.getTaxFree()).isFalse();
        assertThat(r.getBalanceOverride()).isEqualTo(8_000_000L);
        assertThat(r.getHouseholdHead()).isTrue();
        assertThat(r.getMonthlyBonus()).isNull();   // 기여금은 적금 전용
    }

    @Test
    void 청약_검증() {
        SavingsService.validate(housing(200, null, null)); // 기간 없고 회차가 120을 넘어도 됨
        assertThatThrownBy(() -> SavingsService.validate(housing(601, null, null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SavingsService.validate(housing(null, -1L, null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SavingsService.validate(housing(null, null, "JEJU"))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 적금으로_저장하면_청약_값은_버린다() {
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        SavingsDto.Request r = new SavingsDto.Request("적금", null, 100_000L, LocalDate.of(2026, 1, 1), 12, 3f, false, null, null,
                null, 5_000_000L, "SEOUL_BUSAN", true, 60_000L, 180_000L);
        SavingsDto.Response res = service.create(1L, r);
        assertThat(res.getKind()).isEqualTo("SAVINGS");
        assertThat(res.getBalanceOverride()).isNull();
        assertThat(res.getRegion()).isNull();
        assertThat(res.getHouseholdHead()).isFalse();
        assertThat(res.getMonthlyBonus()).isEqualTo(60_000L);
        assertThat(res.getBonusBalance()).isEqualTo(180_000L);
    }

    @Test
    void 기여금은_음수_불가() {
        SavingsDto.Request r = new SavingsDto.Request("적금", null, 100_000L, LocalDate.of(2026, 1, 1), 12, 3f, false, null, null,
                null, null, null, null, -1L, null);
        assertThatThrownBy(() -> SavingsService.validate(r)).isInstanceOf(IllegalArgumentException.class);
    }
}
