package com.dailo.app.service;

import com.dailo.app.dto.DashboardSummaryDto;
import com.dailo.app.entity.AllocationInputMode;
import com.dailo.app.entity.BudgetAllocationItem;
import com.dailo.app.entity.MonthlyBudget;
import com.dailo.app.repository.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

// 2026-09 이후 달은 레거시 생활비 비율이 0 — 생활비 예산은 '생활비' 분배 항목 금액이어야 함 (예전엔 0원 → 잔액이 -지출로 나옴)
class DashboardLivingBudgetTest {

    private final MonthlyBudgetRepository budgetRepo = mock(MonthlyBudgetRepository.class);
    private final DailyExpenseRepository expenseRepo = mock(DailyExpenseRepository.class);
    private final FixedCostRepository fixedRepo = mock(FixedCostRepository.class);
    private final IncomeRepository incomeRepo = mock(IncomeRepository.class);
    private final BudgetAllocationItemRepository itemRepo = mock(BudgetAllocationItemRepository.class);
    private final DashboardService service = new DashboardService(budgetRepo, expenseRepo, fixedRepo, incomeRepo, itemRepo);

    @Test
    void 생활비_예산은_같은_이름_항목_금액() {
        MonthlyBudget b = mock(MonthlyBudget.class);
        when(b.getId()).thenReturn(21L);
        com.dailo.app.entity.Member m = mock(com.dailo.app.entity.Member.class);
        when(m.getId()).thenReturn(1L);
        when(b.getMember()).thenReturn(m);
        when(b.getNetSalary()).thenReturn(2_000_000);
        when(b.getLivingRate()).thenReturn(0.0);
        when(b.getIsaRate()).thenReturn(0.0);
        when(b.getPensionRate()).thenReturn(0.0);
        when(b.getEmergencyRate()).thenReturn(0.0);
        when(b.getDiscretionaryRate()).thenReturn(0.0);
        when(b.getLivingCarryover()).thenReturn(0);
        when(b.getCardGoal()).thenReturn(0);
        when(budgetRepo.findByMemberIdAndSettleMonth(1L, "2026-11")).thenReturn(Optional.of(b));
        when(fixedRepo.sumActiveByMemberId(1L)).thenReturn(0);
        when(incomeRepo.sumByMemberIdAndSettleMonth(1L, "2026-11")).thenReturn(0);
        when(expenseRepo.sumLivingExpense(1L, "2026-11")).thenReturn(100_000);
        when(expenseRepo.sumCardExpense(1L, "2026-11")).thenReturn(0);
        when(expenseRepo.sumEmergencyExpense(1L, "2026-11")).thenReturn(0);
        BudgetAllocationItem living = mock(BudgetAllocationItem.class);
        when(living.getLabel()).thenReturn("생활비");
        when(living.getInputMode()).thenReturn(AllocationInputMode.AMOUNT);
        when(living.getBudgetAmount()).thenReturn(580_880);
        when(itemRepo.findByMonthlyBudgetIdOrderBySortOrderAsc(21L)).thenReturn(List.of(living));

        DashboardSummaryDto dto = service.getSummary(1L, "2026-11");

        assertThat(dto.getLivingBudget()).isEqualTo(580_880);
        assertThat(dto.getLivingBalance()).isEqualTo(480_880);
    }
}
