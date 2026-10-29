package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "invest_account")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestAccount extends BaseEntity {

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 20)
    private String type; // PENSION, IRP, ISA, GENERAL

    @Column(nullable = false)
    private Float targetPct;

    private Integer sortOrder;

    // 매달 이 계좌에 넣는 돈(납입 정책). null이면 예전 방식 — 월 투자금 × targetPct
    //  예산 분배 항목에 연결돼 있으면 최신 달 예산 저장 때 그 금액으로 맞춰짐 (MonthlyBudgetService.syncInvestContributions)
    private Integer monthlyAmount;

    // 계좌 목적 RETIRE(노후) / HOUSE(주택) / WEDDING(결혼) / OTHER — null = 미정
    @Column(length = 20)
    private String purpose;

    // 쓸 예정 연월 'YYYY-MM' — null = 미정 (날짜 있는 계좌만 위험자산 비중 안내)
    @Column(length = 7)
    private String targetDate;

    // 계좌 사용 여부 — false면 납입금 0·리밸런싱 추천 제외 (보유 자산은 평가금액 합계에 그대로 포함). null = 사용 중(예전 로우)
    private Boolean active;

    public void update(String name, String type, Float targetPct, Integer sortOrder) {
        this.name = name;
        this.type = type;
        this.targetPct = targetPct;
        this.sortOrder = sortOrder;
    }

    public void updatePlan(Integer monthlyAmount, String purpose, String targetDate) {
        this.monthlyAmount = monthlyAmount;
        this.purpose = purpose;
        this.targetDate = targetDate;
    }

    // null이면 기존 값 유지
    public void updateActive(Boolean active) {
        if (active != null) this.active = active;
    }

    public boolean isOn() {
        return active == null || active;
    }

    public void updateMonthlyAmount(Integer monthlyAmount) {
        this.monthlyAmount = monthlyAmount;
    }

    // 이번 달 이 계좌 납입금 (꺼진 계좌는 0)
    public int contribution(int settingBudget) {
        if (!isOn()) return 0;
        return monthlyAmount != null ? monthlyAmount : (int) Math.round(settingBudget * (targetPct / 100.0));
    }
}