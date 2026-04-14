package com.dailo.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FixedCostRequestDto {

    private Long memberId;
    private String name;
    private Integer amount;
    private Boolean isActive;
    private Integer sortOrder;
}