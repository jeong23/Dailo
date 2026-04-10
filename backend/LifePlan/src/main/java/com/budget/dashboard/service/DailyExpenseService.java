package com.budget.dashboard.service;

import com.budget.dashboard.dto.DailyExpenseRequestDto;
import com.budget.dashboard.dto.DailyExpenseResponseDto;
import com.budget.dashboard.entity.Category;
import com.budget.dashboard.entity.DailyExpense;
import com.budget.dashboard.entity.MonthlyBudget;
import com.budget.dashboard.repository.CategoryRepository;
import com.budget.dashboard.repository.DailyExpenseRepository;
import com.budget.dashboard.repository.MonthlyBudgetRepository;
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
    public DailyExpenseResponseDto create(DailyExpenseRequestDto request) {
        MonthlyBudget monthlyBudget = monthlyBudgetRepository.findById(request.getMonthlyBudgetId())
                .orElseThrow(() -> new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + request.getMonthlyBudgetId()));

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

    public DailyExpenseResponseDto findById(Long id) {
        DailyExpense expense = dailyExpenseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("지출을 찾을 수 없습니다: " + id));
        return DailyExpenseResponseDto.from(expense);
    }

    public List<DailyExpenseResponseDto> findByMonthlyBudgetId(Long monthlyBudgetId) {
        return dailyExpenseRepository.findByMonthlyBudgetIdOrderByExpenseDateDesc(monthlyBudgetId).stream()
                .map(DailyExpenseResponseDto::from)
                .collect(Collectors.toList());
    }

    public List<DailyExpenseResponseDto> findBySettleMonth(String settleMonth) {
        return dailyExpenseRepository.findBySettleMonthOrderByExpenseDateDesc(settleMonth).stream()
                .map(DailyExpenseResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public DailyExpenseResponseDto update(Long id, DailyExpenseRequestDto request) {
        DailyExpense expense = dailyExpenseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("지출을 찾을 수 없습니다: " + id));

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
    public void delete(Long id) {
        if (!dailyExpenseRepository.existsById(id)) {
            throw new IllegalArgumentException("지출을 찾을 수 없습니다: " + id);
        }
        dailyExpenseRepository.deleteById(id);
    }
}