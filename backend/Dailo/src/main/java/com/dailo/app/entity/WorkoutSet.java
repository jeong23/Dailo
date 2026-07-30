package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "workout_set")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class WorkoutSet extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workout_log_id", nullable = false)
    private WorkoutLog workoutLog;

    @Column(nullable = false, length = 100)
    private String exerciseName;

    // 세션 내 종목 그룹 순서 (같은 종목의 세트들을 묶어서 표시하는 데 사용)
    @Column(nullable = false)
    private Integer exerciseSortOrder;

    @Column(nullable = false)
    private Integer setNumber;

    private Float weightKg;

    private Integer reps;

    @Column(nullable = false)
    private Boolean isDone;

    public void update(String exerciseName, Integer exerciseSortOrder, Integer setNumber,
                        Float weightKg, Integer reps, Boolean isDone) {
        this.exerciseName = exerciseName;
        this.exerciseSortOrder = exerciseSortOrder;
        this.setNumber = setNumber;
        this.weightKg = weightKg;
        this.reps = reps;
        this.isDone = isDone;
    }
}
