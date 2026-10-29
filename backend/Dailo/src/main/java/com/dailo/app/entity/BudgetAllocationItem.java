package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "budget_allocation_item",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_budget_allocation_item_budget_label",
        columnNames = {"monthly_budget_id", "label"}
    )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class BudgetAllocationItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "monthly_budget_id", nullable = false)
    private MonthlyBudget monthlyBudget;   // 단방향 — MonthlyBudget 쪽에 @OneToMany 안 둠 (Habit/HabitLog 컨벤션과 동일)

    @Column(name = "label", nullable = false, length = 50)
    private String label;

    @Column(name = "rate", nullable = false, columnDefinition = "DECIMAL(5,4) DEFAULT 0.0000")
    private Double rate;

    @Column(name = "budget_amount")
    private Integer budgetAmount;  // nullable — null-safe 접근 필수

    @Column(name = "sort_order", nullable = false, columnDefinition = "INT DEFAULT 0")
    private Integer sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "input_mode", nullable = false, length = 10, columnDefinition = "VARCHAR(10) DEFAULT 'RATE'")
    private AllocationInputMode inputMode;

    // 연결된 투자 계좌 (예: 'ISA' 항목 → ISA 계좌). 최신 달 예산 저장 때 이 금액이 계좌 월 납입금이 됨 — null = 연결 없음
    @Column(name = "invest_account_id")
    private Long investAccountId;

    // 연결된 적금·청약 (예: '청년미래저축' 항목). 최신 달 예산 저장 때 이 금액이 월 납입액이 됨 — investAccountId와 둘 중 하나만
    @Column(name = "savings_id")
    private Long savingsId;

    public void update(String label, Double rate, Integer budgetAmount, Integer sortOrder, AllocationInputMode inputMode) {
        this.label = label;
        this.rate = rate;
        this.budgetAmount = budgetAmount;
        this.sortOrder = sortOrder;
        this.inputMode = inputMode;
    }
}
