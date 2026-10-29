package com.dailo.app.repository;

import com.dailo.app.dto.CategoryStatsDto;
import com.dailo.app.dto.DailyStatsDto;
import com.dailo.app.entity.DailyExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

// daily_expense엔 member 컬럼이 없음 — 소유자는 monthlyBudget.member. settleMonth는 회원 간 유니크가 아니므로
// 월 기준 조회·집계는 반드시 memberId 조건을 같이 건다 (빼면 같은 달 다른 회원 지출이 합산됨 — IDOR)
public interface DailyExpenseRepository extends JpaRepository<DailyExpense, Long> {

    List<DailyExpense> findByMonthlyBudgetIdOrderByExpenseDateDescCreatedAtDesc(Long monthlyBudgetId);

    List<DailyExpense> findByMonthlyBudgetMemberIdAndSettleMonthOrderByExpenseDateDescCreatedAtDesc(Long memberId, String settleMonth);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId AND e.settleMonth = :month AND e.budgetType = '생활비'")
    Integer sumLivingExpense(@Param("memberId") Long memberId, @Param("month") String month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId AND e.settleMonth = :month AND e.paymentMethod ='카드'")
    Integer sumCardExpense(@Param("memberId") Long memberId, @Param("month") String month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId AND e.settleMonth = :month AND e.budgetType = '비상금'")
    Integer sumEmergencyExpense(@Param("memberId") Long memberId, @Param("month") String month);

    @Query("SELECT new com.dailo.app.dto.DailyStatsDto(e.expenseDate, CAST(SUM(e.amount) AS integer)) " +
           "FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId AND e.settleMonth = :month " +
           "GROUP BY e.expenseDate ORDER BY e.expenseDate")
    List<DailyStatsDto> findDailyStatsBySettleMonth(@Param("memberId") Long memberId, @Param("month") String month);

    @Query("SELECT new com.dailo.app.dto.CategoryStatsDto(" +
           "e.category.id, e.category.name, e.category.icon, CAST(SUM(e.amount) AS integer)) " +
           "FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId AND e.settleMonth = :month " +
           "GROUP BY e.category.id, e.category.name, e.category.icon " +
           "ORDER BY SUM(e.amount) DESC")
    List<CategoryStatsDto> findCategoryStatsBySettleMonth(@Param("memberId") Long memberId, @Param("month") String month);
}
