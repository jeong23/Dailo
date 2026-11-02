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

    // 현금 잔액 계산용 — 기준 잔액 달부터
    List<DailyExpense> findByMonthlyBudgetMemberIdAndSettleMonthGreaterThanEqual(Long memberId, String settleMonth);

    // 적금·청약 납입 기록 (SavingsService 목록의 records)
    List<DailyExpense> findByMonthlyBudgetMemberIdAndSavingsIdIsNotNullOrderByExpenseDateAsc(Long memberId);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId AND e.settleMonth = :month AND e.budgetType = '생활비'")
    Integer sumLivingExpense(@Param("memberId") Long memberId, @Param("month") String month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId AND e.settleMonth = :month AND e.paymentMethod ='카드'")
    Integer sumCardExpense(@Param("memberId") Long memberId, @Param("month") String month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId AND e.settleMonth = :month AND e.budgetType = '비상금'")
    Integer sumEmergencyExpense(@Param("memberId") Long memberId, @Param("month") String month);

    // 리포트·비상금 추이용 정산월별 합계 한 번에 — [settleMonth, 생활비, 비상금, 카드] (달마다 sum* 3번 부르던 N+1 대체)
    @Query("SELECT e.settleMonth, " +
           "COALESCE(SUM(CASE WHEN e.budgetType = '생활비' THEN e.amount ELSE 0 END), 0), " +
           "COALESCE(SUM(CASE WHEN e.budgetType = '비상금' THEN e.amount ELSE 0 END), 0), " +
           "COALESCE(SUM(CASE WHEN e.paymentMethod = '카드' THEN e.amount ELSE 0 END), 0) " +
           "FROM DailyExpense e WHERE e.monthlyBudget.member.id = :memberId GROUP BY e.settleMonth")
    List<Object[]> sumByMonth(@Param("memberId") Long memberId);

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
