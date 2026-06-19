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

    public void update(String ticker, Float targetPct, Integer sortOrder, Integer avgPurchasePrice, Float shares) {
        this.ticker = ticker;
        this.targetPct = targetPct;
        this.sortOrder = sortOrder;
        this.avgPurchasePrice = avgPurchasePrice;
        this.shares = shares;
    }
}