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

    public void update(String ticker, Float targetPct, Integer sortOrder) {
        this.ticker = ticker;
        this.targetPct = targetPct;
        this.sortOrder = sortOrder;
    }
}