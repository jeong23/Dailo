package com.dailo.app.dto;

import com.dailo.app.entity.DailyExpense;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@Builder
public class DailyExpenseResponseDto {

    private Long id;
    private Long monthlyBudgetId;
    private Long categoryId;
    private String categoryName;
    private String itemName;
    private Integer amount;
    private LocalDate expenseDate;
    private String settleMonth;
    private String paymentMethod;
    private String budgetType;
    private String memo;
    private Long cashAccountId;
    private Long savingsId;
    private LocalDateTime createdAt;

    public static DailyExpenseResponseDto from(DailyExpense expense) {
        return DailyExpenseResponseDto.builder()
                .id(expense.getId())
                .monthlyBudgetId(expense.getMonthlyBudget().getId())
                .categoryId(expense.getCategory().getId())
                .categoryName(expense.getCategory().getName())
                .itemName(expense.getItemName())
                .amount(expense.getAmount())
                .expenseDate(expense.getExpenseDate())
                .settleMonth(expense.getSettleMonth())
                .paymentMethod(expense.getPaymentMethod())
                .budgetType(expense.getBudgetType())
                .memo(expense.getMemo())
                .cashAccountId(expense.getCashAccountId())
                .savingsId(expense.getSavingsId())
                .createdAt(expense.getCreatedAt())
                .build();
    }
}