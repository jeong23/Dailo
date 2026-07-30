package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "cash_asset",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_cash_asset_member_settlemonth",
                columnNames = {"member_id", "settle_month"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class CashAsset extends BaseEntity {

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "settle_month", nullable = false, length = 7)
    private String settleMonth;

    @Column(nullable = false)
    private Integer balance;

    private Integer livingSurplusApplied; // nullable, 감사추적용

    @Column(length = 200)
    private String memo;

    public void update(Integer balance, Integer livingSurplusApplied, String memo) {
        this.balance = balance;
        this.livingSurplusApplied = livingSurplusApplied;
        this.memo = memo;
    }
}
