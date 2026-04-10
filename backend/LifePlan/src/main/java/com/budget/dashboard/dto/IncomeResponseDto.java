package com.budget.dashboard.dto;

import com.budget.dashboard.entity.Income;
import lombok.*;

import java.time.LocalDate;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncomeResponseDto {

    private Long id;
    private Integer amount;
    private LocalDate incomeDate;
    private String settleMonth;
    private String source;
    private String memo;

    public static IncomeResponseDto from(Income income) {
        return IncomeResponseDto.builder()
                .id(income.getId())
                .amount(income.getAmount())
                .incomeDate(income.getIncomeDate())
                .settleMonth(income.getSettleMonth())
                .source(income.getSource())
                .memo(income.getMemo())
                .build();
    }
}
