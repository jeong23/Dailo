package com.budget.dashboard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class EmergencyHistoryDto {

    private String settleMonth;

    private Integer emergencyBudget;      // 이번 달 배분액 (가용금액의 15%)
    private Integer emergencyExpense;     // 이번 달 실지출
    private Integer emergencyNet;         // 순증감 (배분 - 지출)
    private Integer cumulativeAmount;     // 누적액 (이전 달부터 순차 계산)
}
