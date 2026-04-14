package com.dailo.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class DashboardSummaryDto {

    // MonthlyBudget에서 꺼내는 값
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

    // DailyExpense 집계값
    private Integer livingExpenseTotal;
    private Integer cardExpenseTotal;
    private Integer emergencyExpenseTotal;

    // 기타 수입 (이자, 환급금 등)
    private Integer extraIncomeTotal;

    // 계산값
    private Integer livingBalance;       // livingBudget + livingCarryover - livingExpenseTotal
    private Integer cardAchievementRate; // cardExpenseTotal / cardGoal * 100
}
