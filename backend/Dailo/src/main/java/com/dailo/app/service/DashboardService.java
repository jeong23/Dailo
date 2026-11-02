package com.dailo.app.service;

import com.dailo.app.dto.AllocationItemResponseDto;
import com.dailo.app.dto.CategoryStatsDto;
import com.dailo.app.dto.DailyStatsDto;
import com.dailo.app.dto.DashboardSummaryDto;
import com.dailo.app.dto.EmergencyHistoryDto;
import com.dailo.app.dto.MonthlyReportDto;
import com.dailo.app.entity.AllocationInputMode;
import com.dailo.app.entity.BudgetAllocationItem;
import com.dailo.app.entity.MonthlyBudget;
import com.dailo.app.repository.BudgetAllocationItemRepository;
import com.dailo.app.repository.DailyExpenseRepository;
import com.dailo.app.repository.FixedCostRepository;
import com.dailo.app.repository.IncomeRepository;
import com.dailo.app.repository.MonthlyBudgetRepository;

import java.util.Collections;
import java.util.List;
import java.util.Map;
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

        // 고정비 — 그 정산월 기준 (오늘 기준이면 할부가 끝난 뒤 지난 달 가용금액이 바뀜)
        Integer fixedCostTotal = fixedCostRepository.sumForSettleMonth(budget.getMember().getId(), month);

        // 기타 수입 (표시용만 - 가용금액 계산에서 제외)
        Integer extraIncomeTotal = incomeRepository.sumByMemberIdAndSettleMonth(memberId, month);

        // 가용금액 및 분배 실시간 계산 (실수령액 - 고정비)
        Integer availableAmount = Math.max(budget.getNetSalary() - fixedCostTotal, 0);
        Integer isaAmount        = (int)(availableAmount * budget.getIsaRate());
        Integer pensionAmount    = (int)(availableAmount * budget.getPensionRate());
        Integer discretionaryBudget = (int)(availableAmount * budget.getDiscretionaryRate());

        List<AllocationItemResponseDto> allocationItems = liveItems(
                budgetAllocationItemRepository.findByMonthlyBudgetIdOrderBySortOrderAsc(budget.getId()), availableAmount);
        // 생활비·비상금 예산 = 같은 이름의 분배 항목 금액 (없으면 레거시 고정 비율 — 2026-08 이전 달)
        Integer livingBudget     = labeledAmount(allocationItems, LIVING, (int)(availableAmount * budget.getLivingRate()));
        Integer emergencyBudget  = labeledAmount(allocationItems, EMERGENCY, (int)(availableAmount * budget.getEmergencyRate()));

        Integer allocationTotal = allocationItems.stream()
                .mapToInt(AllocationItemResponseDto::getBudgetAmount)
                .sum();

        // 지출 집계
        Integer livingExpenseTotal   = dailyExpenseRepository.sumLivingExpense(memberId, month);
        Integer cardExpenseTotal     = dailyExpenseRepository.sumCardExpense(memberId, month);
        Integer emergencyExpenseTotal = dailyExpenseRepository.sumEmergencyExpense(memberId, month);

        // 계산값
        // 이월액·카드 목표는 nullable — API로 빼고 만든 예산이면 null이라 언박싱 NPE(500)가 났음
        int livingCarryover = budget.getLivingCarryover() != null ? budget.getLivingCarryover() : 0;
        int cardGoal = budget.getCardGoal() != null ? budget.getCardGoal() : 0;
        Integer livingBalance = livingBudget + livingCarryover - livingExpenseTotal;
        Integer cardAchievementRate = cardGoal > 0
                ? (cardExpenseTotal * 100) / cardGoal
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
                .allocationTotal(allocationTotal)
                .cardGoal(cardGoal)
                .livingCarryover(livingCarryover)
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
    public List<DailyStatsDto> getDailyStats(Long memberId, String month) {
        return dailyExpenseRepository.findDailyStatsBySettleMonth(memberId, month);
    }

    @Transactional(readOnly = true)
    public List<CategoryStatsDto> getCategoryStats(Long memberId, String month) {
        return dailyExpenseRepository.findCategoryStatsBySettleMonth(memberId, month);
    }

    @Transactional(readOnly = true)
    public List<EmergencyHistoryDto> getEmergencyHistory(Long memberId) {
        List<MonthlyBudget> budgets = monthlyBudgetRepository.findByMemberIdOrderBySettleMonthAsc(memberId);
        Map<String, long[]> sums = expenseSumsByMonth(memberId);

        int cumulative = 0;
        List<EmergencyHistoryDto> result = new java.util.ArrayList<>();

        for (MonthlyBudget budget : budgets) {
            String month = budget.getSettleMonth();

            Integer fixedCostTotal   = budget.getFixedCostTotal() != null ? budget.getFixedCostTotal() : 0;
            Integer availableAmount  = Math.max(budget.getNetSalary() - fixedCostTotal, 0);
            Integer emergencyBudget  = (int)(availableAmount * budget.getEmergencyRate());
            Integer emergencyExpense = (int) sums.getOrDefault(month, NO_SUMS)[1];
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
        if (budgets.isEmpty()) {
            return Collections.emptyList();
        }

        // N+1 방지: budgetIds를 모아 IN절로 분배 항목 한 번에 조회 후 Map으로 그룹핑 (루프 안에서는 lookup만)
        List<Long> budgetIds = budgets.stream().map(MonthlyBudget::getId).collect(Collectors.toList());
        Map<Long, List<BudgetAllocationItem>> itemsByBudgetId = budgetAllocationItemRepository
                .findByMonthlyBudgetIdIn(budgetIds).stream()
                .sorted(java.util.Comparator.comparing(i -> i.getSortOrder() != null ? i.getSortOrder() : 0))
                .collect(Collectors.groupingBy(i -> i.getMonthlyBudget().getId()));
        Map<String, long[]> sums = expenseSumsByMonth(memberId);
        Map<String, Integer> incomes = new java.util.HashMap<>();
        incomeRepository.sumByMonth(memberId).forEach(r -> incomes.put((String) r[0], ((Number) r[1]).intValue()));

        return budgets.stream().map(budget -> {
            String month = budget.getSettleMonth();
            Integer fixedCostTotal   = budget.getFixedCostTotal() != null ? budget.getFixedCostTotal() : 0;
            Integer extraIncomeTotal = incomes.getOrDefault(month, 0);
            Integer availableAmount  = Math.max(budget.getNetSalary() - fixedCostTotal, 0);
            List<AllocationItemResponseDto> items = liveItems(itemsByBudgetId.getOrDefault(budget.getId(), List.of()), availableAmount);
            Integer allocationTotal  = items.stream().mapToInt(AllocationItemResponseDto::getBudgetAmount).sum();
            Integer livingBudget     = labeledAmount(items, LIVING, (int)(availableAmount * budget.getLivingRate()));
            Integer isaAmount        = (int)(availableAmount * budget.getIsaRate());
            Integer pensionAmount    = (int)(availableAmount * budget.getPensionRate());
            Integer emergencyBudget  = labeledAmount(items, EMERGENCY, (int)(availableAmount * budget.getEmergencyRate()));

            long[] s = sums.getOrDefault(month, NO_SUMS);
            Integer livingExpenseTotal   = (int) s[0];
            Integer emergencyExpenseTotal = (int) s[1];
            Integer cardExpenseTotal     = (int) s[2];

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
                    .allocationTotal(allocationTotal)
                    .allocationItems(items)
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

    private static final long[] NO_SUMS = {0, 0, 0};

    // 정산월 → [생활비, 비상금, 카드] 지출 합계 (쿼리 1번)
    private Map<String, long[]> expenseSumsByMonth(Long memberId) {
        Map<String, long[]> out = new java.util.HashMap<>();
        dailyExpenseRepository.sumByMonth(memberId).forEach(r -> out.put((String) r[0], new long[]{
                ((Number) r[1]).longValue(), ((Number) r[2]).longValue(), ((Number) r[3]).longValue()}));
        return out;
    }

    private static final String LIVING = "생활비";
    private static final String EMERGENCY = "비상금";

    // 분배 항목 금액을 그 달 가용금액 기준으로 — MonthlyBudgetService.buildAllocationItems()와 반드시 동일 원칙
    //  RATE: 저장된 rate × 실시간 가용금액(반올림) / AMOUNT: 입력 금액 그대로 (재계산 금지)
    private static List<AllocationItemResponseDto> liveItems(List<BudgetAllocationItem> items, int available) {
        return items.stream().map(item -> {
            boolean isAmountMode = item.getInputMode() == AllocationInputMode.AMOUNT;
            int amount = isAmountMode
                    ? (item.getBudgetAmount() != null ? item.getBudgetAmount() : 0)
                    : (int) Math.round(available * (item.getRate() != null ? item.getRate() : 0.0));
            return AllocationItemResponseDto.builder()
                    .id(item.getId()).label(item.getLabel()).rate(item.getRate())
                    .budgetAmount(amount).sortOrder(item.getSortOrder()).inputMode(item.getInputMode())
                    .investAccountId(item.getInvestAccountId()).savingsId(item.getSavingsId())
                    .build();
        }).collect(Collectors.toList());
    }

    // 이름이 같은 분배 항목 금액 — 고정 5칸(생활비 비율 등)이 0인 새 달은 이게 기준. 항목이 없으면 레거시 값
    private static int labeledAmount(List<AllocationItemResponseDto> items, String label, int legacy) {
        return items.stream().filter(i -> label.equals(i.getLabel() != null ? i.getLabel().trim() : null))
                .mapToInt(AllocationItemResponseDto::getBudgetAmount).findFirst().orElse(legacy);
    }
}
