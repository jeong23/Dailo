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

    @Column(name = "year_month", nullable = false, length = 7)
    private String yearMonth; // "2026-05"

    private Integer plannedAmt;
    private Integer actualAmt;
    private Boolean isPaid;
    private Float currentPct;

    public void updatePlanned(Integer plannedAmt) {
        this.plannedAmt = plannedAmt;
    }

    public void updateActual(Integer actualAmt, Boolean isPaid, Float currentPct) {
        this.actualAmt = actualAmt;
        this.isPaid = isPaid;
        this.currentPct = currentPct;
    }
}