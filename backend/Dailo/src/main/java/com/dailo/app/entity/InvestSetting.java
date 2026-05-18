package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "invest_setting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestSetting extends BaseEntity {

    @Column(nullable = false, unique = true)
    private Long memberId;

    private Integer monthlyBudget;

    @Column(nullable = false)
    private Float rebalanceThreshold; // %, default 5.0

    @Column(nullable = false)
    private Integer pensionLimit; // default 6,000,000

    public void update(Integer monthlyBudget, Float rebalanceThreshold, Integer pensionLimit) {
        this.monthlyBudget = monthlyBudget;
        this.rebalanceThreshold = rebalanceThreshold;
        this.pensionLimit = pensionLimit;
    }
}