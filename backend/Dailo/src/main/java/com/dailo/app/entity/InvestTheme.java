package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 투자 테마 — 종목은 유행을 타니 비중은 테마(미국 지수·AI·원자재…) 단위로 고정하고 리밸런싱한다.
 * targetPct는 투자 자산 전체 대비 %, 회원의 테마 합계 100.
 * cash=true면 현금성 테마 — 소속 종목은 주수 대신 금액(InvestHolding.manualValue)으로 평가.
 * satellite=true면 위성 테마(코어-새틀라이트) — targetPct는 목표가 아니라 상한. 납입금으로 사라고 추천하지 않고 넘으면 안내만.
 */
@Entity
@Table(name = "invest_theme", indexes = @Index(name = "idx_invest_theme_member", columnList = "member_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestTheme extends BaseEntity {

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false)
    private Float targetPct;

    @Column(nullable = false)
    private Boolean cash;

    private Boolean satellite;  // null = false (컬럼 추가 전 행)

    private Integer sortOrder;

    public void update(String name, Float targetPct, Boolean cash, Boolean satellite, Integer sortOrder) {
        this.name = name;
        this.targetPct = targetPct;
        this.cash = cash;
        this.satellite = satellite;
        this.sortOrder = sortOrder;
    }

    public boolean isSatelliteTheme() {
        return Boolean.TRUE.equals(satellite);
    }
}
