package com.dailo.app.service;

import com.dailo.app.dto.InvestDto;
import com.dailo.app.entity.InvestHolding;
import com.dailo.app.entity.InvestTrade;
import com.dailo.app.repository.InvestHoldingRepository;
import com.dailo.app.repository.InvestMonthlyRecordRepository;
import com.dailo.app.repository.InvestTradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;

/**
 * 체결 완료 → 보유 수량·평균단가 자동 반영 (리밸런싱 순환의 마지막 단계).
 *  매수: 수량 += q, 평균단가 = (기존 평균 × 기존 수량 + 체결가 × q) / 새 수량  (가중평균, 원 단위 반올림)
 *  매도: 수량 -= q, 평균단가 유지 (매도는 평균단가를 바꾸지 않음)
 * 이번 달 기록에 수동 현재가가 있으면 평가금액도 새 수량으로 다시 계산.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvestTradeService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final InvestHoldingRepository holdingRepo;
    private final InvestTradeRepository tradeRepo;
    private final InvestMonthlyRecordRepository recordRepo;

    @Transactional
    public InvestDto.TradeResponse record(Long memberId, Long holdingId, InvestDto.TradeRequest req) {
        InvestHolding holding = ownedHolding(memberId, holdingId);
        String side = req.getSide() == null ? "" : req.getSide().trim().toUpperCase();
        if (!side.equals("BUY") && !side.equals("SELL")) throw new IllegalArgumentException("매수(BUY) 또는 매도(SELL)만 가능해요");
        if (req.getShares() == null || !(req.getShares() > 0)) throw new IllegalArgumentException("체결 수량을 입력해주세요");
        if (req.getPrice() == null || req.getPrice() <= 0) throw new IllegalArgumentException("체결 단가를 입력해주세요");

        float before = holding.getShares() != null ? holding.getShares() : 0f;
        Integer avgBefore = holding.getAvgPurchasePrice();
        float q = req.getShares();
        float after;
        Integer avgAfter;
        if (side.equals("BUY")) {
            after = before + q;
            double cost = (avgBefore != null ? (double) avgBefore * before : 0) + (double) req.getPrice() * q;
            avgAfter = (int) Math.round(cost / after);
        } else {
            if (q > before + 1e-6) throw new IllegalArgumentException("보유 수량(" + trim(before) + "주)보다 많이 팔 수 없어요");
            after = Math.max(before - q, 0f);
            avgAfter = avgBefore;
        }

        InvestTrade trade = tradeRepo.save(InvestTrade.builder()
                .memberId(memberId).accountId(holding.getAccount().getId()).holdingId(holding.getId())
                .ticker(holding.getTicker()).stockCode(holding.getStockCode())
                .side(side).shares(q).price(req.getPrice())
                .tradeDate(req.getTradeDate() != null ? req.getTradeDate() : LocalDate.now(KST))
                .sharesBefore(before).avgBefore(avgBefore)
                .build());
        holding.applyPosition(after, avgAfter);
        refreshEval(holding, after);
        return InvestDto.TradeResponse.of(trade, after, avgAfter);
    }

    public List<InvestDto.TradeResponse> list(Long memberId, String yearMonth) {
        YearMonth ym = YearMonth.parse(yearMonth);
        return tradeRepo.findByMemberIdAndTradeDateBetweenOrderByIdDesc(memberId, ym.atDay(1), ym.atEndOfMonth()).stream()
                .map(t -> InvestDto.TradeResponse.of(t, null, null))
                .toList();
    }

    /** 되돌리기 — 그 종목의 가장 최근 체결만 (중간 기록을 빼면 이후 평균단가 계산이 어긋남) */
    @Transactional
    public void undo(Long memberId, Long tradeId) {
        InvestTrade trade = tradeRepo.findById(tradeId)
                .filter(t -> t.getMemberId().equals(memberId))
                .orElseThrow(() -> new IllegalArgumentException("체결 기록을 찾을 수 없습니다: " + tradeId));
        InvestTrade latest = tradeRepo.findTopByHoldingIdOrderByIdDesc(trade.getHoldingId()).orElse(trade);
        if (!latest.getId().equals(trade.getId())) {
            throw new IllegalArgumentException("가장 최근 체결부터 되돌릴 수 있어요");
        }
        holdingRepo.findById(trade.getHoldingId())
                .filter(h -> h.getAccount().getMemberId().equals(memberId))
                .ifPresent(h -> {
                    h.applyPosition(trade.getSharesBefore(), trade.getAvgBefore());
                    refreshEval(h, trade.getSharesBefore() != null ? trade.getSharesBefore() : 0f);
                });
        tradeRepo.delete(trade);
    }

    private InvestHolding ownedHolding(Long memberId, Long holdingId) {
        return holdingRepo.findById(holdingId)
                .filter(h -> h.getAccount().getMemberId().equals(memberId))
                .orElseThrow(() -> new IllegalArgumentException("종목을 찾을 수 없습니다: " + holdingId));
    }

    // 이번 달 기록의 수동 현재가 × 새 수량 → 평가금액 (현재가가 없으면 그대로)
    private void refreshEval(InvestHolding holding, float shares) {
        String ym = YearMonth.now(KST).toString();
        recordRepo.findByHoldingIdAndYearMonth(holding.getId(), ym).ifPresent(r -> {
            if (r.getCurrentPrice() != null) {
                r.updateActual(r.getActualAmt(), r.getIsPaid(), r.getCurrentPrice(), Math.round(r.getCurrentPrice() * shares));
            }
        });
    }

    private static String trim(float v) {
        return v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(v);
    }
}
