package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "daily_plan")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class DailyPlan extends BaseEntity {

    @Column(nullable = false, unique = true)
    private LocalDate planDate;

    // 미래 시각화 (R2 이미지 URL)
    private String futureVisionUrl;

    // 정체성
    private String identity1;
    private String identity2;
    private String identity3;

    // 내적동기
    private String motivation1;
    private String motivation2;
    private String motivation3;

    // 감사일기
    private String gratitude1;
    private String gratitude2;
    private String gratitude3;

    // 기상 직후 할 일
    private String firstTask;

    // Feedback
    @Column(length = 500)
    private String feedbackStart;

    @Column(length = 500)
    private String feedbackMid;

    @Column(length = 500)
    private String feedbackEnd;

    public void update(String futureVisionUrl,
                       String identity1, String identity2, String identity3,
                       String motivation1, String motivation2, String motivation3,
                       String gratitude1, String gratitude2, String gratitude3,
                       String firstTask,
                       String feedbackStart, String feedbackMid, String feedbackEnd) {
        this.futureVisionUrl = futureVisionUrl;
        this.identity1 = identity1;
        this.identity2 = identity2;
        this.identity3 = identity3;
        this.motivation1 = motivation1;
        this.motivation2 = motivation2;
        this.motivation3 = motivation3;
        this.gratitude1 = gratitude1;
        this.gratitude2 = gratitude2;
        this.gratitude3 = gratitude3;
        this.firstTask = firstTask;
        this.feedbackStart = feedbackStart;
        this.feedbackMid = feedbackMid;
        this.feedbackEnd = feedbackEnd;
    }
}
