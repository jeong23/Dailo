package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "fixed_cost")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class FixedCost extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false, length = 50)
    private String name;

    private Integer amount;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    private Integer sortOrder;

    // RECURRING(매달 계속) | INSTALLMENT(할부) — 기존 로우는 null → RECURRING 취급
    @Column(length = 20)
    private String costType;

    // 할부 전용: 첫 결제일 / 총 개월 수 / 마지막 결제일(start + months-1, 저장 시 계산 — 합계 쿼리용)
    private LocalDate installmentStart;
    private Integer installmentMonths;
    private LocalDate installmentEnd;

    public static final String RECURRING = "RECURRING";
    public static final String INSTALLMENT = "INSTALLMENT";

    public boolean isInstallment() {
        return INSTALLMENT.equals(costType);
    }

    public void update(String name, Integer amount, Boolean isActive, Integer sortOrder) {
        this.name = name;
        this.amount = amount;
        this.isActive = isActive;
        this.sortOrder = sortOrder;
    }

    public void updateSchedule(String costType, LocalDate installmentStart, Integer installmentMonths) {
        if (INSTALLMENT.equals(costType)) {
            this.costType = INSTALLMENT;
            this.installmentStart = installmentStart;
            this.installmentMonths = installmentMonths;
            this.installmentEnd = installmentStart.plusMonths(installmentMonths - 1);
        } else {
            this.costType = RECURRING;
            this.installmentStart = null;
            this.installmentMonths = null;
            this.installmentEnd = null;
        }
    }
}