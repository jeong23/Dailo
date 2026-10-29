package com.dailo.app.service;

import com.dailo.app.dto.InvestDto;
import com.dailo.app.entity.InvestAccount;
import com.dailo.app.entity.InvestHolding;
import com.dailo.app.entity.InvestTrade;
import com.dailo.app.repository.InvestHoldingRepository;
import com.dailo.app.repository.InvestMonthlyRecordRepository;
import com.dailo.app.repository.InvestTradeRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyFloat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

// 체결 완료 → 보유 수량·평균단가 반영 규칙 + 다른 회원 종목 차단
class InvestTradeServiceTest {

    private static final Long ME = 1L;
    private static final Long OTHER = 2L;

    private final InvestHoldingRepository holdingRepo = mock(InvestHoldingRepository.class);
    private final InvestTradeRepository tradeRepo = mock(InvestTradeRepository.class);
    private final InvestMonthlyRecordRepository recordRepo = mock(InvestMonthlyRecordRepository.class);
    private final InvestTradeService service = new InvestTradeService(holdingRepo, tradeRepo, recordRepo);

    InvestTradeServiceTest() {
        when(tradeRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(recordRepo.findByHoldingIdAndYearMonth(any(), anyString())).thenReturn(Optional.empty());
    }

    private InvestHolding holding(Long owner, Float shares, Integer avg) {
        InvestAccount account = mock(InvestAccount.class);
        when(account.getMemberId()).thenReturn(owner);
        when(account.getId()).thenReturn(100L);
        InvestHolding h = mock(InvestHolding.class);
        when(h.getId()).thenReturn(7L);
        when(h.getAccount()).thenReturn(account);
        when(h.getTicker()).thenReturn("TIGER 미국S&P500");
        when(h.getShares()).thenReturn(shares);
        when(h.getAvgPurchasePrice()).thenReturn(avg);
        when(holdingRepo.findById(7L)).thenReturn(Optional.of(h));
        return h;
    }

    @Test
    void 매수는_수량을_늘리고_평균단가를_가중평균으로() {
        InvestHolding h = holding(ME, 10f, 20000);

        InvestDto.TradeResponse res = service.record(ME, 7L, new InvestDto.TradeRequest("BUY", 5f, 26000, null));

        // (20000×10 + 26000×5) / 15 = 22000
        verify(h).applyPosition(15f, 22000);
        assertThat(res.getAmount()).isEqualTo(130000);
    }

    @Test
    void 처음_사는_종목은_체결가가_평균단가() {
        InvestHolding h = holding(ME, null, null);
        service.record(ME, 7L, new InvestDto.TradeRequest("buy", 3f, 12630, null));
        verify(h).applyPosition(3f, 12630);
    }

    @Test
    void 매도는_수량만_줄이고_평균단가_유지() {
        InvestHolding h = holding(ME, 10f, 20000);
        service.record(ME, 7L, new InvestDto.TradeRequest("SELL", 4f, 30000, null));
        verify(h).applyPosition(6f, 20000);
    }

    @Test
    void 보유보다_많이_팔_수_없다() {
        InvestHolding h = holding(ME, 2f, 20000);
        assertThatThrownBy(() -> service.record(ME, 7L, new InvestDto.TradeRequest("SELL", 3f, 30000, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(h, never()).applyPosition(anyFloat(), anyInt());
        verify(tradeRepo, never()).save(any());
    }

    @Test
    void 다른_회원의_종목엔_체결을_기록할_수_없다() {
        InvestHolding h = holding(OTHER, 10f, 20000);
        assertThatThrownBy(() -> service.record(ME, 7L, new InvestDto.TradeRequest("BUY", 1f, 1000, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(h, never()).applyPosition(anyFloat(), anyInt());
    }

    @Test
    void 가장_최근_체결이_아니면_되돌릴_수_없다() {
        InvestTrade old = mock(InvestTrade.class);
        when(old.getId()).thenReturn(1L);
        when(old.getMemberId()).thenReturn(ME);
        when(old.getHoldingId()).thenReturn(7L);
        InvestTrade latest = mock(InvestTrade.class);
        when(latest.getId()).thenReturn(2L);
        when(tradeRepo.findById(1L)).thenReturn(Optional.of(old));
        when(tradeRepo.findTopByHoldingIdOrderByIdDesc(7L)).thenReturn(Optional.of(latest));

        assertThatThrownBy(() -> service.undo(ME, 1L)).isInstanceOf(IllegalArgumentException.class);
        verify(tradeRepo, never()).delete(any());
    }

    @Test
    void 되돌리면_체결_전_수량과_평균단가로() {
        InvestHolding h = holding(ME, 15f, 22000);
        InvestTrade trade = mock(InvestTrade.class);
        when(trade.getId()).thenReturn(3L);
        when(trade.getMemberId()).thenReturn(ME);
        when(trade.getHoldingId()).thenReturn(7L);
        when(trade.getSharesBefore()).thenReturn(10f);
        when(trade.getAvgBefore()).thenReturn(20000);
        when(tradeRepo.findById(3L)).thenReturn(Optional.of(trade));
        when(tradeRepo.findTopByHoldingIdOrderByIdDesc(7L)).thenReturn(Optional.of(trade));

        service.undo(ME, 3L);

        verify(h).applyPosition(10f, 20000);
        verify(tradeRepo).delete(trade);
    }
}
