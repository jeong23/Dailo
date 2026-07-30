package com.dailo.app.service;

import com.dailo.app.dto.AllocationItemResponseDto;
import com.dailo.app.dto.CategoryStatsDto;
import com.dailo.app.dto.DailyStatsDto;
import com.dailo.app.dto.DashboardSummaryDto;
import com.dailo.app.dto.EmergencyHistoryDto;
import com.dailo.app.dto.MonthlyReportDto;
import com.dailo.app.entity.BudgetAllocationItem;
import com.dailo.app.entity.MonthlyBudget;
import com.dailo.app.repository.BudgetAllocationItemRepository;
import com.dailo.app.repository.DailyExpenseRepository;
import com.dailo.app.repository.FixedCostRepository;
import com.dailo.app.repository.IncomeRepository;
import com.dailo.app.repository.MonthlyBudgetRepository;

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
    private final BudgetAllocationItemRepository budgetAllocationItemRepository;

    @Transactional(readOnly = true)
    public DashboardSummaryDto getSummary(Long memberId, String month) {
        // 인증된 사용자 본인의 예산만 조회 (IDOR 방지 — settleMonth만으로 전역 조회하면 다른 회원 데이터가 나올 수 있었음)
        MonthlyBudget budget = monthlyBudgetRepository.findByMemberIdAndSettleMonth(memberId, month)
                .orElseThrow(() -> new IllegalArgumentException("해당 월 예산이 없습니다."));

        // 고정비 실시간 조회
        Integer fixedCostTotal = fixedCostRepository.sumActiveByMemberId(budget.getMember().getId());

        // 기타 수입 (표시용만 - 가용금액 계산에서 제외)
        Integer extraIncomeTotal = incomeRepository.sumBySettleMonth(month);

        // 가용금액 및 분배 실시간 계산 (실수령액 - 고정비)
        Integer availableAmount = Math.max(budget.getNetSalary() - fixedCostTotal, 0);
        Integer livingBudget     = (int)(availableAmount * budget.getLivingRate());
        Integer isaAmount        = (int)(availableAmount * budget.getIsaRate());
        Integer pensionAmount    = (int)(availableAmount * budget.getPensionRate());
        Integer emergencyBudget  = (int)(availableAmount * budget.getEmergencyRate());
        Integer discretionaryBudget = (int)(availableAmount * budget.getDiscretionaryRate());

        // 가변 개수 분배 항목 — rate는 저장된 값(스냅샷)을 쓰되 금액은 실시간 availableAmount로 재계산 (living/isa 등과 동일 원칙)
        final Integer availableAmountFinal = availableAmount;
        List<AllocationItemResponseDto> allocationItems = budgetAllocationItemRepository
                .findByMonthlyBudgetIdOrderBySortOrderAsc(budget.getId()).stream()
                .map(item -> AllocationItemResponseDto.builder()
                        .id(item.getId())
                        .label(item.getLabel())
                        .rate(item.getRate())
                        .budgetAmount((int)(availableAmountFinal * (item.getRate() != null ? item.getRate() : 0.0)))
                        .sortOrder(item.getSortOrder())
                        .build())
                .collect(Collectors.toList());

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
                .allocationItems(allocationItems)
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

            Integer fixedCostTotal   = budget.getFixedCostTotal() != null ? budget.getFixedCostTotal() : 0;
            Integer availableAmount  = Math.max(budget.getNetSalary() - fixedCostTotal, 0);
            Integer emergencyBudget  = (int)(availableAmount * budget.getEmergencyRate());
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
            Integer availableAmount  = Math.max(budget.getNetSalary() - fixedCostTotal, 0);
            Integer livingBudget     = (int)(availableAmount * budget.getLivingRate());
            Integer isaAmount        = (int)(availableAmount * budget.getIsaRate());
            Integer pensionAmount    = (int)(availableAmount * budget.getPensionRate());
            Integer emergencyBudget  = (int)(availableAmount * budget.getEmergencyRate());

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
