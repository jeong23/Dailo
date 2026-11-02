package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "invest_holding")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestHolding extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private InvestAccount account;

    @Column(nullable = false, length = 100)
    private String ticker;

    @Column(nullable = false)
    private Float targetPct; // 계좌 내 비중, 0-100

    private Integer sortOrder;
    private Integer avgPurchasePrice; // 매입 평균단가
    private Float shares;             // 보유 수량

    @Column(length = 12)
    private String stockCode;         // 거래소 종목코드 6자리 (예: 360750) — 실시간 시세 구독용, 없으면 수동 현재가

    private Long themeId;             // 투자 테마 (InvestTheme.id, 없으면 미분류)
    private Integer manualValue;      // 현금성·펀드처럼 주수가 없는 항목의 평가금액(직접 입력)

    public void update(String ticker, Float targetPct, Integer sortOrder, Integer avgPurchasePrice, Float shares, String stockCode) {
        this.ticker = ticker;
        this.targetPct = targetPct;
        this.sortOrder = sortOrder;
        this.avgPurchasePrice = avgPurchasePrice;
        this.shares = shares;
        this.stockCode = stockCode;
    }

    /** 테마 배정 + 직접 입력 금액 (설정 저장 시) */
    public void assign(Long themeId, Integer manualValue) {
        this.themeId = themeId;
        this.manualValue = manualValue;
    }

    /** 체결 반영 — 보유 수량·평균단가만 바꿈 (InvestTradeService) */
    // 예수금 줄 금액 증감 (체결 반영·되돌리기) — 0 아래로는 안 내려감
    public void adjustManualValue(int delta) {
        this.manualValue = Math.max((manualValue != null ? manualValue : 0) + delta, 0);
    }

    public void applyPosition(Float shares, Integer avgPurchasePrice) {
        this.shares = shares;
        this.avgPurchasePrice = avgPurchasePrice;
    }
}
