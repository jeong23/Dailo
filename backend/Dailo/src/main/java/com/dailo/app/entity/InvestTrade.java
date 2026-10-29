package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * 체결 기록 — 리밸런싱 추천을 실행하고 '체결 완료'를 누르면 남는다.
 * 종목(holding)을 지워도 기록은 남도록 FK 대신 id·이름 스냅샷을 저장.
 * sharesBefore/avgBefore는 되돌리기(가장 최근 체결만)용.
 */
@Entity
@Table(name = "invest_trade", indexes = {
        @Index(name = "idx_invest_trade_member_date", columnList = "member_id, trade_date"),
        @Index(name = "idx_invest_trade_holding", columnList = "holding_id")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestTrade extends BaseEntity {

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "holding_id", nullable = false)
    private Long holdingId;

    @Column(nullable = false, length = 100)
    private String ticker;

    @Column(length = 12)
    private String stockCode;

    @Column(nullable = false, length = 4)
    private String side;          // BUY / SELL

    @Column(nullable = false)
    private Float shares;         // 체결 수량

    @Column(nullable = false)
    private Integer price;        // 체결 단가

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    private Float sharesBefore;   // 체결 전 보유 수량
    private Integer avgBefore;    // 체결 전 평균단가
}
