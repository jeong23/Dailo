package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "monthly_budget")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class MonthlyBudget extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(length = 7)
    private String settleMonth;

    private Integer netSalary;

    private Integer fixedCostTotal;

    private Integer availableAmount;

    private Integer livingBudget;

    private Integer isaAmount;

    private Integer pensionAmount;

    private Integer emergencyBudget;

    private Integer discretionaryBudget;

    private Integer cardGoal;

    private Integer livingCarryover;

    private Integer emergencyCumulative;

    @Column(nullable = false, columnDefinition = "DECIMAL(5,4) DEFAULT 0.3500")
    private Double livingRate;

    @Column(nullable = false, columnDefinition = "DECIMAL(5,4) DEFAULT 0.2500")
    private Double isaRate;

    @Column(nullable = false, columnDefinition = "DECIMAL(5,4) DEFAULT 0.1500")
    private Double pensionRate;

    @Column(nullable = false, columnDefinition = "DECIMAL(5,4) DEFAULT 0.1500")
    private Double emergencyRate;

    @Column(nullable = false, columnDefinition = "DECIMAL(5,4) DEFAULT 0.1000")
    private Double discretionaryRate;

    public void update(Integer netSalary, Integer fixedCostTotal, Integer availableAmount,
                       Integer livingBudget, Integer isaAmount, Integer pensionAmount,
                       Integer emergencyBudget, Integer discretionaryBudget, Integer cardGoal,
                       Integer livingCarryover, Integer emergencyCumulative,
                       Double livingRate, Double isaRate, Double pensionRate,
                       Double emergencyRate, Double discretionaryRate) {
        this.netSalary = netSalary;
        this.fixedCostTotal = fixedCostTotal;
        this.availableAmount = availableAmount;
        this.livingBudget = livingBudget;
        this.isaAmount = isaAmount;
        this.pensionAmount = pensionAmount;
        this.emergencyBudget = emergencyBudget;
        this.discretionaryBudget = discretionaryBudget;
        this.cardGoal = cardGoal;
        this.livingCarryover = livingCarryover;
        this.emergencyCumulative = emergencyCumulative;
        this.livingRate = livingRate;
        this.isaRate = isaRate;
        this.pensionRate = pensionRate;
        this.emergencyRate = emergencyRate;
        this.discretionaryRate = discretionaryRate;
    }
}