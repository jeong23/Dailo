package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

// 현금 계좌 (입출금·CMA·파킹통장 등) — '내 계좌 > 현금'에서 등록
//  켜진 계좌 잔액 합계가 그 정산월 cash_asset.balance로 기록됨 (CashAccountService.syncMonth) — 현금 자산 추이·자산 배분은 그대로 cash_asset을 읽음
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

    // false = 꺼진 계좌 — 합계에서 빠짐. null = 사용 중
    private Boolean active;

    private Integer sortOrder;

    @Column(length = 200)
    private String memo;

    public void update(String name, String bank, Long balance, String memo) {
        this.name = name;
        this.bank = bank;
        this.balance = balance;
        this.memo = memo;
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
