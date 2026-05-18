package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "invest_diary")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestDiary extends BaseEntity {

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(length = 20)
    private String marketMood; // BULLISH, NEUTRAL, BEARISH

    @Column(length = 20)
    private String myEmotion; // CONFIDENT, CALM, ANXIOUS, FEARFUL

    @Column(length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    public void update(String marketMood, String myEmotion, String title, String body) {
        this.marketMood = marketMood;
        this.myEmotion = myEmotion;
        this.title = title;
        this.body = body;
    }
}