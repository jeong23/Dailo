package com.dailo.app.repository;

import com.dailo.app.dto.CategoryStatsDto;
import com.dailo.app.dto.DailyStatsDto;
import com.dailo.app.entity.DailyExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface DailyExpenseRepository extends JpaRepository<DailyExpense, Long> {

    List<DailyExpense> findByMonthlyBudgetIdOrderByExpenseDateDescCreatedAtDesc(Long monthlyBudgetId);

    List<DailyExpense> findBySettleMonthOrderByExpenseDateDescCreatedAtDesc(String settleMonth);

    List<DailyExpense> findByExpenseDateBetweenOrderByExpenseDateDescCreatedAtDesc(LocalDate startDate, LocalDate endDate);

    List<DailyExpense> findByCategoryIdAndSettleMonth(Long categoryId, String settleMonth);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.settleMonth = :month AND e.budgetType = '생활비'")
    Integer sumLivingExpense(@Param("month") String month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.settleMonth = :month AND e.paymentMethod ='카드'")
    Integer sumCardExpense(@Param("month") String month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.settleMonth = :month AND e.budgetType = '비상금'")
    Integer sumEmergencyExpense(@Param("month") String month);

    @Query("SELECT new com.dailo.app.dto.DailyStatsDto(e.expenseDate, CAST(SUM(e.amount) AS integer)) " +
           "FROM DailyExpense e WHERE e.settleMonth = :month GROUP BY e.expenseDate ORDER BY e.expenseDate")
    List<DailyStatsDto> findDailyStatsBySettleMonth(@Param("month") String month);

    @Query("SELECT new com.dailo.app.dto.CategoryStatsDto(" +
           "e.category.id, e.category.name, e.category.icon, CAST(SUM(e.amount) AS integer)) " +
           "FROM DailyExpense e WHERE e.settleMonth = :month " +
           "GROUP BY e.category.id, e.category.name, e.category.icon " +
           "ORDER BY SUM(e.amount) DESC")
    List<CategoryStatsDto> findCategoryStatsBySettleMonth(@Param("month") String month);
}