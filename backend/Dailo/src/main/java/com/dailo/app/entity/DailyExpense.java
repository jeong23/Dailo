package com.dailo.app.entity;

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

    // 돈이 나간 현금 계좌 — null이면 기본 계좌(켜진 계좌 중 첫 번째). 카드는 카드값이 빠지는 계좌
    private Long cashAccountId;

    // 적금·청약 납입 기록 — 있으면 그 정산월 납입은 이 지출로 확인된 것 (현금 잔액에서 자동 납입 대신 이 기록만 빠짐)
    private Long savingsId;

    // 날짜를 바꾸면 정산월·예산도 같이 옮김 — 예전엔 정산월이 등록 때 값 그대로라 다른 달 합계에 남았음
    public void update(MonthlyBudget monthlyBudget, String settleMonth, Category category, String itemName, Integer amount,
                       java.time.LocalDate expenseDate, String paymentMethod,
                       String budgetType, String memo, Long cashAccountId, Long savingsId) {
        this.monthlyBudget = monthlyBudget;
        this.settleMonth = settleMonth;
        this.category = category;
        this.itemName = itemName;
        this.amount = amount;
        this.expenseDate = expenseDate;
        this.paymentMethod = paymentMethod;
        this.budgetType = budgetType;
        this.memo = memo;
        this.cashAccountId = cashAccountId;
        this.savingsId = savingsId;
    }
}