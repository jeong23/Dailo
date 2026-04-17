package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "running_goal", uniqueConstraints = @UniqueConstraint(columnNames = {"year", "month"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class RunningGoal extends BaseEntity {

    @Column(nullable = false)
    private Integer year;

    @Column(nullable = false)
    private Integer month;

    // 목표 횟수 (예: 12회)
    @Column(nullable = false)
    private Integer targetCount;

    // 목표 거리 km (예: 50km), nullable
    private Double targetDistanceKm;

    public void update(Integer targetCount, Double targetDistanceKm) {
        this.targetCount = targetCount;
        this.targetDistanceKm = targetDistanceKm;
    }
}
