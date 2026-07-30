package com.dailo.app.repository;

import com.dailo.app.entity.WorkoutRoutineExercise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WorkoutRoutineExerciseRepository extends JpaRepository<WorkoutRoutineExercise, Long> {
    List<WorkoutRoutineExercise> findByRoutineIdOrderBySortOrderAsc(Long routineId);
    List<WorkoutRoutineExercise> findByRoutineIdInOrderBySortOrderAsc(List<Long> routineIds);
    void deleteByRoutineId(Long routineId);
}
