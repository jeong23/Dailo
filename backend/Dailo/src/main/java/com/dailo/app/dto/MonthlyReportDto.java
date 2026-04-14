package com.dailo.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class MonthlyReportDto {

    private String settleMonth;

    // 수입/예산
    private Integer netSalary;
    private Integer fixedCostTotal;
    private Integer extraIncomeTotal;
    private Integer availableAmount;

    // 생활비
    private Integer livingBudget;
    private Integer livingCarryover;
    private Integer livingExpenseTotal;
    private Integer livingBalance;  // livingBudget + livingCarryover - livingExpenseTotal

    // 비상금
    private Integer emergencyBudget;
    private Integer emergencyExpenseTotal;

    // 투자
    private Integer isaAmount;
    private Integer pensionAmount;

    // 카드 실적
    private Integer cardGoal;
    private Integer cardExpenseTotal;
    private Integer cardAchievementRate;
}
