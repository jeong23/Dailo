package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "invest_setting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestSetting extends BaseEntity {

    @Column(nullable = false, unique = true)
    private Long memberId;

    private Integer monthlyBudget;

    @Column(nullable = false)
    private Float rebalanceThreshold; // %, default 5.0

    @Column(nullable = false)
    private Integer pensionLimit; // default 6,000,000

    // 리밸런싱 때 넘친 종목·테마를 팔지 (false = 납입금으로만 맞춤). null = true
    private Boolean allowSell;

    // 가입 때 고른 전략 프리셋 LIQUIDITY / TAX / EQUAL / CUSTOM — 표시·재적용용, 계산은 계좌 납입금·allowSell로
    @Column(length = 20)
    private String strategyPreset;

    // 세액공제 계산기 입력 (회원별 — 예전엔 브라우저 localStorage). 실수령액은 최신 월별 예산 netSalary를 씀
    private Integer taxJoinMonth;      // 올해 입사월 1~12 (1 = 연중 계속 근무)
    private Boolean taxProbation;      // 수습 중 (급여 80%)
    private Integer taxProbEndMonth;   // 수습 종료 예정월 1~12

    public void update(Integer monthlyBudget, Float rebalanceThreshold, Integer pensionLimit) {
        this.monthlyBudget = monthlyBudget;
        this.rebalanceThreshold = rebalanceThreshold;
        this.pensionLimit = pensionLimit;
    }

    // null이면 기존 값 유지 (부분 업데이트)
    public void updateStrategy(Boolean allowSell, String strategyPreset) {
        if (allowSell != null) this.allowSell = allowSell;
        if (strategyPreset != null) this.strategyPreset = strategyPreset;
    }

    public void updateTaxInputs(Integer joinMonth, Boolean probation, Integer probEndMonth) {
        this.taxJoinMonth = joinMonth;
        this.taxProbation = probation;
        this.taxProbEndMonth = probEndMonth;
    }

    public boolean isSellAllowed() {
        return !Boolean.FALSE.equals(allowSell);
    }
}