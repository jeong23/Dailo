package com.dailo.app.dto;

import com.dailo.app.entity.MonthlyBudget;
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
    private Double livingRate;
    private Double isaRate;
    private Double pensionRate;
    private Double emergencyRate;
    private Double discretionaryRate;
    private Double extra1Rate;
    private Double extra2Rate;
    private Double extra3Rate;
    private Integer extra1Budget;
    private Integer extra2Budget;
    private Integer extra3Budget;
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
                .extra1Budget(budget.getExtra1Budget())
                .extra2Budget(budget.getExtra2Budget())
                .extra3Budget(budget.getExtra3Budget())
                .cardGoal(budget.getCardGoal())
                .livingCarryover(budget.getLivingCarryover())
                .emergencyCumulative(budget.getEmergencyCumulative())
                .livingRate(budget.getLivingRate())
                .isaRate(budget.getIsaRate())
                .pensionRate(budget.getPensionRate())
                .emergencyRate(budget.getEmergencyRate())
                .discretionaryRate(budget.getDiscretionaryRate())
                .extra1Rate(budget.getExtra1Rate())
                .extra2Rate(budget.getExtra2Rate())
                .extra3Rate(budget.getExtra3Rate())
                .createdAt(budget.getCreatedAt())
                .updatedAt(budget.getUpdatedAt())
                .build();
    }
}