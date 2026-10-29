package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

// 운동 종목 즐겨찾기 — 종목 마스터 테이블이 없어서 종목명 문자열로 저장 (workout_set.exercise_name과 동일한 방식)
@Entity
@Table(name = "workout_bookmark", uniqueConstraints = @UniqueConstraint(columnNames = {"member_id", "exercise_name"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class WorkoutBookmark extends BaseEntity {

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 100)
    private String exerciseName;
}
