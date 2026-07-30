package com.dailo.app.repository;

import com.dailo.app.entity.WorkoutLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WorkoutLogRepository extends JpaRepository<WorkoutLog, Long> {
    List<WorkoutLog> findByMemberIdAndWorkoutDateBetweenOrderByWorkoutDateAsc(
            Long memberId, LocalDate start, LocalDate end);
    Optional<WorkoutLog> findByMemberIdAndWorkoutDate(Long memberId, LocalDate workoutDate);
}
