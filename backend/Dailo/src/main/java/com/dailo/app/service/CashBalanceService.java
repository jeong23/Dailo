package com.dailo.app.service;

import com.dailo.app.entity.CashAccount;
import com.dailo.app.entity.CashAsset;
import com.dailo.app.entity.Member;
import com.dailo.app.entity.MonthlyBudget;
import com.dailo.app.entity.Savings;
import com.dailo.app.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

// 현금 계좌 기준 잔액 + 지출·수입·월급·고정비·적금 납입 → 현재 잔액·달별 잔액 (계산은 CashFlow)
//  저장하지 않고 읽을 때마다 계산 — 지출을 고치거나 지워도 되돌릴 게 없음
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CashBalanceService {

    private static final Pattern YEAR_MONTH = Pattern.compile("\\d{4}-(0[1-9]|1[0-2])");

    private final CashAccountRepository accountRepo;
    private final CashAssetRepository cashAssetRepo;
    private final DailyExpenseRepository expenseRepo;
    private final IncomeRepository incomeRepo;
    private final MonthlyBudgetRepository budgetRepo;
    private final FixedCostRepository fixedCostRepo;
    private final SavingsRepository savingsRepo;
    private final MemberRepository memberRepo;

    // currentMonth: 프론트 기준 현재 정산월 (월급일 설정이 프론트에 있음) — 없거나 틀리면 달력 기준 이번 달
    public CashFlow.Result compute(Long memberId, String currentMonth) {
        List<CashAccount> accounts = accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(memberId);
        if (accounts.isEmpty()) return CashFlow.Result.empty();
        String current = validMonth(currentMonth) ? currentMonth : YearMonth.now().toString();
        String fallbackMonth = cashAssetRepo.findByMemberIdOrderBySettleMonthAsc(memberId).stream()
                .map(CashAsset::getSettleMonth).max(Comparator.naturalOrder()).orElse(current);

        List<CashFlow.Anchor> anchors = accounts.stream().map(a -> new CashFlow.Anchor(
                a.getId(), a.isOn(), a.getBalance(), asOf(a),
                validMonth(a.getBalanceMonth()) ? a.getBalanceMonth() : fallbackMonth)).toList();
        String from = anchors.stream().map(CashFlow.Anchor::month).min(Comparator.naturalOrder()).orElse(current);

        List<CashFlow.Event> events = new ArrayList<>();
        Map<Long, Set<String>> recorded = new HashMap<>();
        expenseRepo.findByMonthlyBudgetMemberIdAndSettleMonthGreaterThanEqual(memberId, from).forEach(e -> {
            if (e.getExpenseDate() == null || e.getSettleMonth() == null || e.getAmount() == null) return;
            if (e.getSavingsId() != null) recorded.computeIfAbsent(e.getSavingsId(), k -> new HashSet<>()).add(e.getSettleMonth());
            events.add(new CashFlow.Event(e.getCashAccountId(), -e.getAmount(), e.getExpenseDate(), e.getCreatedAt(),
                    e.getSettleMonth(), "카드".equals(e.getPaymentMethod())));
        });
        incomeRepo.findByMemberIdAndSettleMonthGreaterThanEqual(memberId, from).forEach(i -> {
            if (i.getIncomeDate() == null || i.getSettleMonth() == null || i.getAmount() == null) return;
            events.add(new CashFlow.Event(i.getCashAccountId(), i.getAmount(), i.getIncomeDate(), i.getCreatedAt(),
                    i.getSettleMonth(), false));
        });

        // 적금·청약 납입 — 기본 계좌에서 납입일에 빠짐. 정산월 판정은 회원 월급일(기본 25), 납입 지출이 적힌 달은 건너뜀
        int salaryDay = memberRepo.findById(memberId).map(Member::getSalaryDay).filter(d -> d != null && d >= 1 && d <= 31).orElse(25);
        LocalDate earliest = anchors.stream().map(a -> a.asOf().toLocalDate()).min(Comparator.naturalOrder()).orElse(LocalDate.now());
        for (Savings s : savingsRepo.findByMemberIdOrderByStartDateAsc(memberId)) {
            long monthlyAmount = s.getMonthlyAmount() == null ? 0 : s.getMonthlyAmount();
            boolean housing = "HOUSING".equals(s.kindOrDefault());
            events.addAll(CashFlow.savingsPayments(s.getStartDate(), monthlyAmount,
                    housing ? null : s.getMonths(), salaryDay, earliest.minusDays(1), current,
                    recorded.getOrDefault(s.getId(), Set.of())));
            // 만기 수령액 — 적금을 지워도 사라지지 않게 SavingsService.delete가 먼저 잔액을 고정(CashAccountService.snapshot)
            if (!housing && s.getMonths() != null) {
                CashFlow.maturityPayout(s.getStartDate(), monthlyAmount, s.getMonths(), s.getRatePct() == null ? 0 : s.getRatePct(),
                        Boolean.TRUE.equals(s.getTaxFree()), s.getMonthlyBonus() == null ? 0 : s.getMonthlyBonus(), s.getBonusBalance(),
                        salaryDay, earliest.minusDays(1), current).ifPresent(events::add);
            }
        }

        // 월급·고정비는 기준 잔액 달 다음 달부터만 쓰임 — 그 달 예산이 있어야 월급이 들어온 걸로 봄
        List<CashFlow.MonthlyFlow> monthly = new ArrayList<>();
        for (MonthlyBudget b : budgetRepo.findByMemberIdOrderBySettleMonthAsc(memberId)) {
            String m = b.getSettleMonth();
            if (!validMonth(m) || m.compareTo(from) <= 0 || m.compareTo(current) > 0) continue;
            Integer fixed = fixedCostRepo.sumForSettleMonth(memberId, m);
            monthly.add(new CashFlow.MonthlyFlow(m, b.getNetSalary() == null ? 0 : b.getNetSalary(), fixed == null ? 0 : fixed));
        }
        return CashFlow.calculate(anchors, events, monthly, current, LocalDate.now());
    }

    private static LocalDateTime asOf(CashAccount a) {
        if (a.getBalanceAsOf() != null) return a.getBalanceAsOf();
        if (a.getUpdatedAt() != null) return a.getUpdatedAt();
        return a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.now();
    }

    static boolean validMonth(String m) {
        return m != null && YEAR_MONTH.matcher(m).matches();
    }
}
