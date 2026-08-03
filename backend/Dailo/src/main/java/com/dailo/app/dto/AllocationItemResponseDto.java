package com.dailo.app.dto;

import com.dailo.app.entity.AllocationInputMode;
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
    private AllocationInputMode inputMode; // 프론트 입력창 렌더링 분기용 (RATE: %입력, AMOUNT: 금액입력)

    // budgetAmount(스냅샷 그대로) 반환 — 재계산은 호출부(MonthlyBudgetService/DashboardService)에서 이미 끝낸 값을 그대로 옮길 때 사용
    public static AllocationItemResponseDto from(BudgetAllocationItem item) {
        return AllocationItemResponseDto.builder()
                .id(item.getId())
                .label(item.getLabel())
                .rate(item.getRate())
                .budgetAmount(item.getBudgetAmount())
                .sortOrder(item.getSortOrder())
                .inputMode(item.getInputMode())
                .build();
    }
}
