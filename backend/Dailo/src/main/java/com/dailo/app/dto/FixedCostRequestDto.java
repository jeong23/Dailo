package com.dailo.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FixedCostRequestDto {

    private String name;
    private Integer amount;
    private Boolean isActive;
    private Integer sortOrder;
    private String costType;          // RECURRING | INSTALLMENT (없으면 RECURRING)
    private LocalDate installmentStart;
    private Integer installmentMonths;
}