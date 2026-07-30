package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "workout_log", uniqueConstraints = @UniqueConstraint(columnNames = {"member_id", "workout_date"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class WorkoutLog extends BaseEntity {

    @Column(nullable = false)
    private Long memberId;

    // 이 세션이 어느 루틴을 기반으로 했는지 (nullable — 루틴 삭제돼도 과거 기록은 유지, FK 관계 아님)
    private Long routineId;

    @Column(nullable = false)
    private LocalDate workoutDate;

    @Column(length = 500)
    private String memo;

    public void update(Long routineId, String memo) {
        this.routineId = routineId;
        this.memo = memo;
    }
}
