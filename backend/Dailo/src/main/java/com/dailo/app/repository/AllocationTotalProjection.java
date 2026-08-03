package com.dailo.app.repository;

// getMonthlyReport() N+1 방지용 — monthly_budget_id별 budget_allocation_item.budget_amount 합계 집계
public interface AllocationTotalProjection {
    Long getMonthlyBudgetId();
    Integer getTotal();
}
