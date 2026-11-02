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

    // 이 달(yyyy-MM) 납입금은 이미 이체해 예수금에 들어가 있음 — 투자 현황 '납입금 포함' 토글을 끈 달.
    // 기기 상관없이 같은 상태여야 해서 서버 저장 (켜 두면 예수금과 납입금이 두 번 잡힘)
    @Column(length = 7)
    private String depositedMonth;

    // 매매 비용 — 이번 달 할 일 계산에 반영. null = 기본값 (DEFAULT_FEE_RATE / DEFAULT_PRICE_BUFFER)
    private Float feeRate;      // 증권사 수수료 % (매수·매도 각각)
    private Float priceBuffer;  // 주문 사이 가격이 오를 때 대비해 남겨둘 % (시장가로 사도 돈이 모자라지 않게)

    public static final float DEFAULT_FEE_RATE = 0.015f;
    public static final float DEFAULT_PRICE_BUFFER = 0.5f;

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

    public void updateTradeCosts(Float feeRate, Float priceBuffer) {
        if (feeRate != null) this.feeRate = feeRate;
        if (priceBuffer != null) this.priceBuffer = priceBuffer;
    }

    public float feeRateOrDefault() {
        return feeRate != null ? feeRate : DEFAULT_FEE_RATE;
    }

    public float priceBufferOrDefault() {
        return priceBuffer != null ? priceBuffer : DEFAULT_PRICE_BUFFER;
    }

    public void markDeposited(String yearMonth, boolean deposited) {
        if (deposited) this.depositedMonth = yearMonth;
        else if (yearMonth.equals(this.depositedMonth)) this.depositedMonth = null;
    }

    public boolean isDeposited(String yearMonth) {
        return yearMonth != null && yearMonth.equals(depositedMonth);
    }

    public boolean isSellAllowed() {
        return !Boolean.FALSE.equals(allowSell);
    }
}