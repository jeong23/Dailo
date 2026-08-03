package com.dailo.app.repository;

import com.dailo.app.entity.BudgetAllocationItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BudgetAllocationItemRepository extends JpaRepository<BudgetAllocationItem, Long> {
    List<BudgetAllocationItem> findByMonthlyBudgetIdOrderBySortOrderAsc(Long monthlyBudgetId);
    List<BudgetAllocationItem> findByMonthlyBudgetIdIn(List<Long> monthlyBudgetIds);

    // 파생 delete 메서드(개별 entity 로드 후 remove())는 Hibernate 기본 flush 순서(INSERT가 DELETE보다 먼저 실행)때문에
    // replace-all 저장 시 UNIQUE(monthly_budget_id, label) 위반이 발생했다 — 즉시 실행되는 벌크 JPQL DELETE로 교체
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM BudgetAllocationItem i WHERE i.monthlyBudget.id = :monthlyBudgetId")
    int deleteByMonthlyBudgetId(@Param("monthlyBudgetId") Long monthlyBudgetId);

    long deleteByIdAndMonthlyBudgetId(Long id, Long monthlyBudgetId);

    // getMonthlyReport() allocationTotal용 — budgetIds를 모아 IN절로 한 번에 집계 (N+1 방지)
    @Query("SELECT i.monthlyBudget.id AS monthlyBudgetId, COALESCE(SUM(i.budgetAmount), 0) AS total " +
           "FROM BudgetAllocationItem i WHERE i.monthlyBudget.id IN :monthlyBudgetIds GROUP BY i.monthlyBudget.id")
    List<AllocationTotalProjection> sumBudgetAmountGroupByMonthlyBudgetIdIn(@Param("monthlyBudgetIds") List<Long> monthlyBudgetIds);
}
