package com.budget.dashboard.dto;

import com.budget.dashboard.entity.MonthlyBudget;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@Builder
public class MonthlyBudgetResponseDto {

    private Long id;
    private Long memberId;
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
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static MonthlyBudgetResponseDto from(MonthlyBudget budget) {
        return MonthlyBudgetResponseDto.builder()
                .id(budget.getId())
                .memberId(budget.getMember().getId())
                .settleMonth(budget.getSettleMonth())
                .netSalary(budget.getNetSalary())
                .fixedCostTotal(budget.getFixedCostTotal())
                .availableAmount(budget.getAvailableAmount())
                .livingBudget(budget.getLivingBudget())
                .isaAmount(budget.getIsaAmount())
                .pensionAmount(budget.getPensionAmount())
                .emergencyBudget(budget.getEmergencyBudget())
                .discretionaryBudget(budget.getDiscretionaryBudget())
                .cardGoal(budget.getCardGoal())
                .livingCarryover(budget.getLivingCarryover())
                .emergencyCumulative(budget.getEmergencyCumulative())
                .createdAt(budget.getCreatedAt())
                .updatedAt(budget.getUpdatedAt())
                .build();
    }
}