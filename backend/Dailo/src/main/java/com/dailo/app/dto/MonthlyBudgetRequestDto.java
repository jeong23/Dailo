package com.dailo.app.dto;

import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyBudgetRequestDto {

    // memberId는 클라이언트 입력을 신뢰하지 않는다 — 인증된 사용자(@AuthenticationPrincipal)의 memberId만 사용한다.
    private String settleMonth;
    private Integer netSalary;
    private Integer fixedCostTotal;
    private Integer availableAmount;
    private Integer livingBudget;
    private Integer isaAmount;
    private Integer pensionAmount;
    private Integer emergencyBudget;
    private Integer discretionaryBudget;
    private Integer cardGoal;
    private Integer livingCarryover;
    private Integer emergencyCumulative;
    private Double livingRate;
    private Double isaRate;
    private Double pensionRate;
    private Double emergencyRate;
    private Double discretionaryRate;
    // 가변 개수 예산 분배 항목(생활비/ISA/연금저축/자유재량 외 사용자 정의 항목) — 전체 교체(replace-all) 방식으로 저장
    @Valid
    private List<AllocationItemRequestDto> allocationItems;
}