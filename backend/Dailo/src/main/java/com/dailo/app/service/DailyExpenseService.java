package com.dailo.app.service;

import com.dailo.app.dto.DailyExpenseRequestDto;
import com.dailo.app.dto.DailyExpenseResponseDto;
import com.dailo.app.entity.Category;
import com.dailo.app.entity.DailyExpense;
import com.dailo.app.entity.MonthlyBudget;
import com.dailo.app.repository.CashAccountRepository;
import com.dailo.app.repository.CategoryRepository;
import com.dailo.app.repository.DailyExpenseRepository;
import com.dailo.app.repository.MonthlyBudgetRepository;
import com.dailo.app.repository.SavingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DailyExpenseService {

    private final DailyExpenseRepository dailyExpenseRepository;
    private final MonthlyBudgetRepository monthlyBudgetRepository;
    private final CategoryRepository categoryRepository;
    private final CashAccountRepository cashAccountRepository;
    private final SavingsRepository savingsRepository;

    @Transactional
    public DailyExpenseResponseDto create(Long memberId, DailyExpenseRequestDto request) {
        MonthlyBudget monthlyBudget = resolveBudget(memberId, request);

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("카테고리를 찾을 수 없습니다: " + request.getCategoryId()));

        DailyExpense expense = DailyExpense.builder()
                .monthlyBudget(monthlyBudget)
                .category(category)
                .itemName(request.getItemName())
                .amount(request.getAmount())
                .expenseDate(request.getExpenseDate())
                .settleMonth(monthlyBudget.getSettleMonth())
                .paymentMethod(request.getPaymentMethod())
                .budgetType(request.getBudgetType())
                .memo(request.getMemo())
                .cashAccountId(ownedCashAccount(memberId, request.getCashAccountId()))
                .savingsId(ownedSavings(memberId, request.getSavingsId()))
                .build();

        return DailyExpenseResponseDto.from(dailyExpenseRepository.save(expense));
    }

    public DailyExpenseResponseDto findById(Long memberId, Long id) {
        return DailyExpenseResponseDto.from(findOwned(memberId, id));
    }

    public List<DailyExpenseResponseDto> findByMonthlyBudgetId(Long memberId, Long monthlyBudgetId) {
        findOwnedBudget(memberId, monthlyBudgetId);
        return dailyExpenseRepository.findByMonthlyBudgetIdOrderByExpenseDateDescCreatedAtDesc(monthlyBudgetId).stream()
                .map(DailyExpenseResponseDto::from)
                .collect(Collectors.toList());
    }

    public List<DailyExpenseResponseDto> findBySettleMonth(Long memberId, String settleMonth) {
        return dailyExpenseRepository.findByMonthlyBudgetMemberIdAndSettleMonthOrderByExpenseDateDescCreatedAtDesc(memberId, settleMonth).stream()
                .map(DailyExpenseResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public DailyExpenseResponseDto update(Long memberId, Long id, DailyExpenseRequestDto request) {
        DailyExpense expense = findOwned(memberId, id);
        MonthlyBudget budget = resolveBudget(memberId, request);

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("카테고리를 찾을 수 없습니다: " + request.getCategoryId()));

        expense.update(
                budget,
                budget.getSettleMonth(),
                category,
                request.getItemName(),
                request.getAmount(),
                request.getExpenseDate(),
                request.getPaymentMethod(),
                request.getBudgetType(),
                request.getMemo(),
                ownedCashAccount(memberId, request.getCashAccountId()),
                ownedSavings(memberId, request.getSavingsId())
        );

        return DailyExpenseResponseDto.from(expense);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        dailyExpenseRepository.delete(findOwned(memberId, id));
    }

    // 지출 소유자 = 연결된 월별 예산의 회원. 다른 회원 것이면 없는 것과 같은 메시지 (IDOR — 존재 여부 숨김)
    private DailyExpense findOwned(Long memberId, Long id) {
        DailyExpense expense = dailyExpenseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("지출을 찾을 수 없습니다: " + id));
        if (!expense.getMonthlyBudget().getMember().getId().equals(memberId)) {
            throw new IllegalArgumentException("지출을 찾을 수 없습니다: " + id);
        }
        return expense;
    }

    // 남의 현금 계좌에 연결 방지 (null = 기본 계좌)
    private Long ownedCashAccount(Long memberId, Long cashAccountId) {
        if (cashAccountId == null) return null;
        return cashAccountRepository.findByIdAndMemberId(cashAccountId, memberId)
                .orElseThrow(() -> new IllegalArgumentException("현금 계좌를 찾을 수 없습니다: " + cashAccountId)).getId();
    }

    // 남의 적금에 납입 기록 연결 방지 (null = 적금 납입 아님)
    private Long ownedSavings(Long memberId, Long savingsId) {
        if (savingsId == null) return null;
        return savingsRepository.findById(savingsId).filter(s -> s.getMemberId().equals(memberId))
                .orElseThrow(() -> new IllegalArgumentException("적금을 찾을 수 없습니다: " + savingsId)).getId();
    }

    // 지출이 들어갈 예산 = 정산월(프론트가 날짜로 계산)의 내 예산. 정산월이 없으면 monthlyBudgetId
    //  예전엔 monthlyBudgetId와 settleMonth를 따로 믿어서 '11월 정산월인데 10월 예산'인 지출이 생길 수 있었음
    private MonthlyBudget resolveBudget(Long memberId, DailyExpenseRequestDto request) {
        String month = request.getSettleMonth();
        if (month != null && month.matches("\\d{4}-(0[1-9]|1[0-2])")) {
            return monthlyBudgetRepository.findByMemberIdAndSettleMonth(memberId, month)
                    .orElseThrow(() -> new IllegalArgumentException(month + " 월별 예산이 없습니다. 예산 설정에서 먼저 등록해주세요."));
        }
        if (request.getMonthlyBudgetId() == null) throw new IllegalArgumentException("정산월이 필요합니다.");
        return findOwnedBudget(memberId, request.getMonthlyBudgetId());
    }

    // 남의 monthlyBudgetId로 지출을 등록하거나 목록을 보는 것 방지
    private MonthlyBudget findOwnedBudget(Long memberId, Long monthlyBudgetId) {
        MonthlyBudget budget = monthlyBudgetRepository.findById(monthlyBudgetId)
                .orElseThrow(() -> new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + monthlyBudgetId));
        if (!budget.getMember().getId().equals(memberId)) {
            throw new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + monthlyBudgetId);
        }
        return budget;
    }
}