package com.dailo.app.dto;

import com.dailo.app.entity.BudgetAllocationItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class AllocationItemResponseDto {
    private Long id;
    private String label;
    private Double rate;
    private Integer budgetAmount;
    private Integer sortOrder;

    public static AllocationItemResponseDto from(BudgetAllocationItem item) {
        return AllocationItemResponseDto.builder()
                .id(item.getId())
                .label(item.getLabel())
                .rate(item.getRate())
                .budgetAmount(item.getBudgetAmount())
                .sortOrder(item.getSortOrder())
                .build();
    }
}
