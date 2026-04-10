package com.budget.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyExpenseRequestDto {

    private Long monthlyBudgetId;
    private Long categoryId;
    private String itemName;
    private Integer amount;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate expenseDate;
    private String settleMonth;
    private String paymentMethod;
    private String budgetType;
    private String memo;
}