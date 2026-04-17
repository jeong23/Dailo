package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "running_record")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class RunningRecord extends BaseEntity {

    @Column(nullable = false)
    private LocalDate runDate;

    // 뛰었는지 여부
    @Column(nullable = false)
    private Boolean ran;

    // 제목
    @Column(length = 100)
    private String title;

    // 거리 (km)
    private Double distanceKm;

    // 시간 (초)
    private Integer durationSeconds;

    // 칼로리 (kcal)
    private Integer calories;

    // 고도 상승 (m)
    private Integer elevationGain;

    // 평균 심박수 (bpm)
    private Integer avgHeartRate;

    // 케이던스 (spm)
    private Integer cadence;

    // 메모
    @Column(length = 500)
    private String memo;

    // 경로 좌표 JSON ([{lat, lng}, ...])
    @Column(columnDefinition = "TEXT")
    private String routeJson;

    public void update(Boolean ran, String title, Double distanceKm, Integer durationSeconds,
                       Integer calories, Integer elevationGain, Integer avgHeartRate,
                       Integer cadence, String memo, String routeJson) {
        this.ran = ran;
        this.title = title;
        this.distanceKm = distanceKm;
        this.durationSeconds = durationSeconds;
        this.calories = calories;
        this.elevationGain = elevationGain;
        this.avgHeartRate = avgHeartRate;
        this.cadence = cadence;
        this.memo = memo;
        this.routeJson = routeJson;
    }
}
