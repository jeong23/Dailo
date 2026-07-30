package com.dailo.app.dto;

import com.dailo.app.entity.BudgetAllocationItem;
import com.dailo.app.entity.MonthlyBudget;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

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
    private List<AllocationItemResponseDto> allocationItems;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static MonthlyBudgetResponseDto from(MonthlyBudget budget) {
        return from(budget, Collections.emptyList());
    }

    public static MonthlyBudgetResponseDto from(MonthlyBudget budget, List<BudgetAllocationItem> items) {
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
                .livingRate(budget.getLivingRate())
                .isaRate(budget.getIsaRate())
                .pensionRate(budget.getPensionRate())
                .emergencyRate(budget.getEmergencyRate())
                .discretionaryRate(budget.getDiscretionaryRate())
                .allocationItems(items.stream()
                        .map(AllocationItemResponseDto::from)
                        .collect(Collectors.toList()))
                .createdAt(budget.getCreatedAt())
                .updatedAt(budget.getUpdatedAt())
                .build();
    }
}