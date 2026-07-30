package com.dailo.app.repository;

import com.dailo.app.entity.WorkoutSet;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WorkoutSetRepository extends JpaRepository<WorkoutSet, Long> {
    List<WorkoutSet> findByWorkoutLogIdOrderByExerciseSortOrderAscSetNumberAsc(Long workoutLogId);
    List<WorkoutSet> findByWorkoutLogIdInOrderByExerciseSortOrderAscSetNumberAsc(List<Long> workoutLogIds);
    void deleteByWorkoutLogId(Long workoutLogId);

    // 종목명 자동완성용 — 빈도순, 동률이면 최근 기록순
    @Query("SELECT s.exerciseName FROM WorkoutSet s " +
           "WHERE s.workoutLog.memberId = :memberId " +
           "GROUP BY s.exerciseName " +
           "ORDER BY COUNT(s) DESC, MAX(s.workoutLog.workoutDate) DESC")
    List<String> findFrequentExerciseNames(@Param("memberId") Long memberId, Pageable pageable);
}
