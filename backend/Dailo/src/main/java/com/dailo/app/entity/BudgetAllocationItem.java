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

    public void update(String label, Double rate, Integer budgetAmount, Integer sortOrder, AllocationInputMode inputMode) {
        this.label = label;
        this.rate = rate;
        this.budgetAmount = budgetAmount;
        this.sortOrder = sortOrder;
        this.inputMode = inputMode;
    }
}
