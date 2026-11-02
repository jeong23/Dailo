package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// 현금 계좌 (입출금·CMA·파킹통장 등) — '내 계좌 > 현금'에서 등록
//  balance는 "기준 잔액" — balanceAsOf 시점에 사용자가 확인한 값. 현재 잔액 = 기준 잔액 + 그 뒤 지출·수입·월급·고정비 (CashFlow 계산)
@Entity
@Table(name = "cash_account")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class CashAccount extends BaseEntity {

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 30)
    private String bank;

    @Column(nullable = false)
    private Long balance;

    // 기준 잔액을 확인한 시각 / 그때 정산월 — null이면 옛 데이터 (updatedAt·최근 cash_asset 달로 대신함)
    private LocalDateTime balanceAsOf;

    @Column(length = 7)
    private String balanceMonth;

    // false = 꺼진 계좌 — 합계에서 빠짐. null = 사용 중
    private Boolean active;

    private Integer sortOrder;

    @Column(length = 200)
    private String memo;

    public void update(String name, String bank, String memo) {
        this.name = name;
        this.bank = bank;
        this.memo = memo;
    }

    // 잔액 맞추기 — 이 시각 이후 기록만 자동 반영
    public void anchor(Long balance, LocalDateTime at, String month) {
        this.balance = balance;
        this.balanceAsOf = at;
        this.balanceMonth = month;
    }

    public void updateActive(boolean active) {
        this.active = active;
    }

    public void updateSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public boolean isOn() {
        return active == null || active;
    }
}
