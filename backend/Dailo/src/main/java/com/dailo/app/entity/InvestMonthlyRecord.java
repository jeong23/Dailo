package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "invest_monthly_record",
        uniqueConstraints = @UniqueConstraint(columnNames = {"holding_id", "year_month"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestMonthlyRecord extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "holding_id", nullable = false)
    private InvestHolding holding;

    @Column(name = "`year_month`", nullable = false, length = 7)
    private String yearMonth; // "2026-05"

    private Integer plannedAmt;
    private Integer actualAmt;
    private Boolean isPaid;
    private Float currentPct; // 레거시 컬럼 유지 (더 이상 사용 안 함)
    private Integer currentPrice; // 현재가 (1주당)
    private Integer evalAmt;     // 평가금액 = currentPrice × shares (자동계산 후 저장)

    public void updatePlanned(Integer plannedAmt) {
        this.plannedAmt = plannedAmt;
    }

    public void updateActual(Integer actualAmt, Boolean isPaid, Integer currentPrice, Integer evalAmt) {
        this.actualAmt = actualAmt;
        this.isPaid = isPaid;
        if (currentPrice != null) { this.currentPrice = currentPrice; this.evalAmt = evalAmt; }
    }
}