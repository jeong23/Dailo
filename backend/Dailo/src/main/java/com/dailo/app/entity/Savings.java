package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * 적금 — 매달 같은 금액을 붓는 정기적금. 고정비(사라지는 돈)와 달리 쌓이는 자산이라 따로 관리.
 * 납입 회차·현재 원금·만기 수령액은 startDate/months/monthlyAmount로 프론트에서 계산(utils/savings.ts).
 * paidOverride: 실제 납입 회차가 계산과 다를 때(밀림·선납) 직접 입력.
 * kind=HOUSING(주택청약종합저축)은 만기 없이 계속 납입 — months는 0, 잔액·지역·세대주 여부로 청약 정보 계산.
 */
@Entity
@Table(name = "savings", indexes = @Index(name = "idx_savings_member", columnList = "member_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Savings extends BaseEntity {

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 100)
    private String name;          // 상품명 (예: 청년도약계좌)

    @Column(length = 50)
    private String bank;

    @Column(nullable = false)
    private Long monthlyAmount;   // 월 납입액

    @Column(nullable = false)
    private LocalDate startDate;  // 첫 납입일 (매달 같은 날 납입)

    @Column(nullable = false)
    private Integer months;       // 가입 기간(개월)

    @Column(nullable = false)
    private Float ratePct;        // 연 이율 % (단리)

    @Column(nullable = false)
    private Boolean taxFree;      // 비과세 여부 (아니면 이자소득세 15.4%)

    private Integer paidOverride; // 실제 납입 회차 직접 입력 (null이면 날짜로 계산)

    @Column(length = 200)
    private String memo;

    @Column(length = 20)
    private String kind;            // SAVINGS(적금, null 포함) | HOUSING(주택청약종합저축)

    private Long balanceOverride;   // 청약: 은행 앱 잔액 직접 입력 (null이면 월 납입액 × 회차)

    @Column(length = 20)
    private String region;          // 청약 민영주택 예치금 지역: SEOUL_BUSAN | METRO | OTHER

    private Boolean householdHead;  // 청약: 무주택 세대주 (소득공제 대상)

    private Long monthlyBonus;      // 적금: 정부기여금 월 금액 (청년미래적금·청년도약계좌 등)

    private Long bonusBalance;      // 적금: 지금까지 적립된 기여금 직접 입력 (null이면 월 기여금 × 회차)

    // 예산 분배 항목 연결 — 최신 달 예산 저장 때 그 금액으로 (MonthlyBudgetService.syncLinkedAmounts)
    public void updateMonthlyAmount(Long monthlyAmount) {
        this.monthlyAmount = monthlyAmount;
    }

    public void update(String name, String bank, Long monthlyAmount, LocalDate startDate, Integer months,
                       Float ratePct, Boolean taxFree, Integer paidOverride, String memo,
                       String kind, Long balanceOverride, String region, Boolean householdHead,
                       Long monthlyBonus, Long bonusBalance) {
        this.name = name;
        this.bank = bank;
        this.monthlyAmount = monthlyAmount;
        this.startDate = startDate;
        this.months = months;
        this.ratePct = ratePct;
        this.taxFree = taxFree;
        this.paidOverride = paidOverride;
        this.memo = memo;
        this.kind = kind;
        this.balanceOverride = balanceOverride;
        this.region = region;
        this.householdHead = householdHead;
        this.monthlyBonus = monthlyBonus;
        this.bonusBalance = bonusBalance;
    }

    public String kindOrDefault() {
        return kind == null ? "SAVINGS" : kind;
    }
}
