package com.dailo.app.service;

import com.dailo.app.dto.DailyExpenseRequestDto;
import com.dailo.app.dto.DailyExpenseResponseDto;
import com.dailo.app.entity.Category;
import com.dailo.app.entity.DailyExpense;
import com.dailo.app.entity.MonthlyBudget;
import com.dailo.app.repository.CategoryRepository;
import com.dailo.app.repository.DailyExpenseRepository;
import com.dailo.app.repository.MonthlyBudgetRepository;
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

    @Transactional
    public DailyExpenseResponseDto create(Long memberId, DailyExpenseRequestDto request) {
        MonthlyBudget monthlyBudget = findOwnedBudget(memberId, request.getMonthlyBudgetId());

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("카테고리를 찾을 수 없습니다: " + request.getCategoryId()));

        DailyExpense expense = DailyExpense.builder()
                .monthlyBudget(monthlyBudget)
                .category(category)
                .itemName(request.getItemName())
                .amount(request.getAmount())
                .expenseDate(request.getExpenseDate())
                .settleMonth(request.getSettleMonth())
                .paymentMethod(request.getPaymentMethod())
                .budgetType(request.getBudgetType())
                .memo(request.getMemo())
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

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("카테고리를 찾을 수 없습니다: " + request.getCategoryId()));

        expense.update(
                category,
                request.getItemName(),
                request.getAmount(),
                request.getExpenseDate(),
                request.getPaymentMethod(),
                request.getBudgetType(),
                request.getMemo()
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