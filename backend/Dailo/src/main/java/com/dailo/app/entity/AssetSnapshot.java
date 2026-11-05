package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 정산월별 순자산 스냅샷 (2026-11-05). 자산 현황 화면을 열 때 그 달 값을 덮어씀 → 마지막 기록이 그 달 말 값.
 * 금액은 화면 계산값(현금 = 현금 자산 최신 잔액, 투자 = 시세 반영 평가금액, 적금 = 현재 원금, manual = 직접 입력 칸 합계)
 */
@Entity
@Table(name = "asset_snapshot",
        uniqueConstraints = @UniqueConstraint(name = "uk_asset_snapshot_member_month", columnNames = {"member_id", "settle_month"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AssetSnapshot extends BaseEntity {

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "settle_month", nullable = false, length = 7)
    private String settleMonth;

    @Column(nullable = false)
    private Long cash;

    @Column(nullable = false)
    private Long invest;

    @Column(nullable = false)
    private Long savings;

    @Column(nullable = false)
    private Long manual;

    @Column(name = "captured_at", nullable = false)
    private LocalDateTime capturedAt;

    public void record(long cash, long invest, long savings, long manual, LocalDateTime at) {
        this.cash = cash;
        this.invest = invest;
        this.savings = savings;
        this.manual = manual;
        this.capturedAt = at;
    }

    public long total() {
        return cash + invest + savings + manual;
    }
}
