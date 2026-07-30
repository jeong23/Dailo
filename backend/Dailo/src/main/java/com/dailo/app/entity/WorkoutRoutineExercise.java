package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "workout_routine_exercise")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class WorkoutRoutineExercise extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "routine_id", nullable = false)
    private WorkoutRoutine routine;

    @Column(nullable = false, length = 100)
    private String exerciseName;

    private Integer targetSets;

    private Integer sortOrder;

    public void update(String exerciseName, Integer targetSets, Integer sortOrder) {
        this.exerciseName = exerciseName;
        this.targetSets = targetSets;
        this.sortOrder = sortOrder;
    }
}
