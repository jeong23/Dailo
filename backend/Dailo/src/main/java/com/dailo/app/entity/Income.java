package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "income")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Income extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    private Integer amount;

    private LocalDate incomeDate;

    @Column(length = 7)
    private String settleMonth;

    @Column(length = 50)
    private String source;

    private String memo;

    public void update(Integer amount, LocalDate incomeDate, String settleMonth, String source, String memo) {
        this.amount = amount;
        this.incomeDate = incomeDate;
        this.settleMonth = settleMonth;
        this.source = source;
        this.memo = memo;
    }
}
