package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 전체 자산 배분 칸 (현금·투자·부동산·적금 …).
 * kind: CASH(현금 자산 최신 잔액) / INVEST(투자 평가금액 합계) / SAVINGS(적금 현재 원금 합계) / MANUAL(manualAmount 직접 입력)
 * targetPct 합계 100.
 */
@Entity
@Table(name = "asset_bucket", indexes = @Index(name = "idx_asset_bucket_member", columnList = "member_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AssetBucket extends BaseEntity {

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 10)
    private String kind;

    @Column(nullable = false)
    private Float targetPct;

    private Long manualAmount;

    private Integer sortOrder;

    public void update(String name, String kind, Float targetPct, Long manualAmount, Integer sortOrder) {
        this.name = name;
        this.kind = kind;
        this.targetPct = targetPct;
        this.manualAmount = manualAmount;
        this.sortOrder = sortOrder;
    }
}
