package com.budget.dashboard.service;

import com.budget.dashboard.dto.CategoryStatsDto;
import com.budget.dashboard.dto.DailyStatsDto;
import com.budget.dashboard.dto.DashboardSummaryDto;
import com.budget.dashboard.dto.EmergencyHistoryDto;
import com.budget.dashboard.dto.MonthlyReportDto;
import com.budget.dashboard.entity.MonthlyBudget;
import com.budget.dashboard.repository.DailyExpenseRepository;
import com.budget.dashboard.repository.FixedCostRepository;
import com.budget.dashboard.repository.IncomeRepository;
import com.budget.dashboard.repository.MonthlyBudgetRepository;

import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DashboardService {
    private final MonthlyBudgetRepository monthlyBudgetRepository;
    private final DailyExpenseRepository dailyExpenseRepository;
    private final FixedCostRepository fixedCostRepository;
    private final IncomeRepository incomeRepository;

    @Transactional(readOnly = true)
    public DashboardSummaryDto getSummary(String month) {
        MonthlyBudget budget = monthlyBudgetRepository.findBySettleMonth(month)
                .orElseThrow(() -> new RuntimeException("해당 월 예산이 없습니다."));

        // 고정비 실시간 조회
        Integer fixedCostTotal = fixedCostRepository.sumActiveByMemberId(budget.getMember().getId());

        // 기타 수입 (이자 등) 조회
        Integer extraIncomeTotal = incomeRepository.sumBySettleMonth(month);

        // 가용금액 및 분배 실시간 계산 (실수령액 + 기타수입 - 고정비)
        Integer availableAmount = Math.max(budget.getNetSalary() + extraIncomeTotal - fixedCostTotal, 0);
        Integer livingBudget     = (int)(availableAmount * 0.35);
        Integer isaAmount        = (int)(availableAmount * 0.25);
        Integer pensionAmount    = (int)(availableAmount * 0.15);
        Integer emergencyBudget  = (int)(availableAmount * 0.15);
        Integer discretionaryBudget = (int)(availableAmount * 0.10);

        // 지출 집계
        Integer livingExpenseTotal   = dailyExpenseRepository.sumLivingExpense(month);
        Integer cardExpenseTotal     = dailyExpenseRepository.sumCardExpense(month);
        Integer emergencyExpenseTotal = dailyExpenseRepository.sumEmergencyExpense(month);

        // 계산값
        Integer livingBalance = livingBudget + budget.getLivingCarryover() - livingExpenseTotal;
        Integer cardAchievementRate = budget.getCardGoal() > 0
                ? (cardExpenseTotal * 100) / budget.getCardGoal()
                : 0;

        return DashboardSummaryDto.builder()
                .netSalary(budget.getNetSalary())
                .fixedCostTotal(fixedCostTotal)
                .availableAmount(availableAmount)
                .livingBudget(livingBudget)
                .isaAmount(isaAmount)
                .pensionAmount(pensionAmount)
                .emergencyBudget(emergencyBudget)
                .discretionaryBudget(discretionaryBudget)
                .cardGoal(budget.getCardGoal())
                .livingCarryover(budget.getLivingCarryover())
                .emergencyCumulative(budget.getEmergencyCumulative())
                .livingExpenseTotal(livingExpenseTotal)
                .cardExpenseTotal(cardExpenseTotal)
                .emergencyExpenseTotal(emergencyExpenseTotal)
                .extraIncomeTotal(extraIncomeTotal)
                .livingBalance(livingBalance)
                .cardAchievementRate(cardAchievementRate)
                .build();
    }

    @Transactional(readOnly = true)
    public List<DailyStatsDto> getDailyStats(String month) {
        return dailyExpenseRepository.findDailyStatsBySettleMonth(month);
    }

    @Transactional(readOnly = true)
    public List<CategoryStatsDto> getCategoryStats(String month) {
        return dailyExpenseRepository.findCategoryStatsBySettleMonth(month);
    }

    @Transactional(readOnly = true)
    public List<EmergencyHistoryDto> getEmergencyHistory(Long memberId) {
        List<MonthlyBudget> budgets = monthlyBudgetRepository.findByMemberIdOrderBySettleMonthAsc(memberId);

        int cumulative = 0;
        List<EmergencyHistoryDto> result = new java.util.ArrayList<>();

        for (MonthlyBudget budget : budgets) {
            String month = budget.getSettleMonth();

            Integer extraIncomeTotal = incomeRepository.sumBySettleMonth(month);
            Integer fixedCostTotal   = budget.getFixedCostTotal() != null ? budget.getFixedCostTotal() : 0;
            Integer availableAmount  = Math.max(budget.getNetSalary() + extraIncomeTotal - fixedCostTotal, 0);
            Integer emergencyBudget  = (int)(availableAmount * 0.15);
            Integer emergencyExpense = dailyExpenseRepository.sumEmergencyExpense(month);
            Integer emergencyNet     = emergencyBudget - emergencyExpense;

            cumulative += emergencyNet;

            result.add(EmergencyHistoryDto.builder()
                    .settleMonth(month)
                    .emergencyBudget(emergencyBudget)
                    .emergencyExpense(emergencyExpense)
                    .emergencyNet(emergencyNet)
                    .cumulativeAmount(cumulative)
                    .build());
        }

        return result;
    }

    @Transactional(readOnly = true)
    public List<MonthlyReportDto> getMonthlyReport(Long memberId) {
        List<MonthlyBudget> budgets = monthlyBudgetRepository.findByMemberIdOrderBySettleMonthDesc(memberId);

        return budgets.stream().map(budget -> {
            String month = budget.getSettleMonth();

            Integer fixedCostTotal   = budget.getFixedCostTotal() != null ? budget.getFixedCostTotal() : 0;
            Integer extraIncomeTotal = incomeRepository.sumBySettleMonth(month);
            Integer availableAmount  = Math.max(budget.getNetSalary() + extraIncomeTotal - fixedCostTotal, 0);
            Integer livingBudget     = (int)(availableAmount * 0.35);
            Integer isaAmount        = (int)(availableAmount * 0.25);
            Integer pensionAmount    = (int)(availableAmount * 0.15);
            Integer emergencyBudget  = (int)(availableAmount * 0.15);

            Integer livingExpenseTotal   = dailyExpenseRepository.sumLivingExpense(month);
            Integer emergencyExpenseTotal = dailyExpenseRepository.sumEmergencyExpense(month);
            Integer cardExpenseTotal     = dailyExpenseRepository.sumCardExpense(month);

            Integer livingCarryover = budget.getLivingCarryover() != null ? budget.getLivingCarryover() : 0;
            Integer livingBalance   = livingBudget + livingCarryover - livingExpenseTotal;

            Integer cardAchievementRate = budget.getCardGoal() != null && budget.getCardGoal() > 0
                    ? (cardExpenseTotal * 100) / budget.getCardGoal()
                    : 0;

            return MonthlyReportDto.builder()
                    .settleMonth(month)
                    .netSalary(budget.getNetSalary())
                    .fixedCostTotal(fixedCostTotal)
                    .extraIncomeTotal(extraIncomeTotal)
                    .availableAmount(availableAmount)
                    .livingBudget(livingBudget)
                    .livingCarryover(livingCarryover)
                    .livingExpenseTotal(livingExpenseTotal)
                    .livingBalance(livingBalance)
                    .emergencyBudget(emergencyBudget)
                    .emergencyExpenseTotal(emergencyExpenseTotal)
                    .isaAmount(isaAmount)
                    .pensionAmount(pensionAmount)
                    .cardGoal(budget.getCardGoal())
                    .cardExpenseTotal(cardExpenseTotal)
                    .cardAchievementRate(cardAchievementRate)
                    .build();
        }).collect(Collectors.toList());
    }
}
