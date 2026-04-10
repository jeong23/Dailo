package com.budget.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "daily_expense")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class DailyExpense extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "monthly_budget_id", nullable = false)
    private MonthlyBudget monthlyBudget;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(length = 100)
    private String itemName;

    private Integer amount;

    private LocalDate expenseDate;

    @Column(length = 7)
    private String settleMonth;

    @Column(length = 10)
    private String paymentMethod;

    @Column(length = 10)
    private String budgetType;

    private String memo;

    public void update(Category category, String itemName, Integer amount,
                       java.time.LocalDate expenseDate, String paymentMethod,
                       String budgetType, String memo) {
        this.category = category;
        this.itemName = itemName;
        this.amount = amount;
        this.expenseDate = expenseDate;
        this.paymentMethod = paymentMethod;
        this.budgetType = budgetType;
        this.memo = memo;
    }
}