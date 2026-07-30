package com.dailo.app.repository;

import com.dailo.app.entity.WorkoutRoutine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WorkoutRoutineRepository extends JpaRepository<WorkoutRoutine, Long> {
    List<WorkoutRoutine> findByMemberIdOrderBySortOrderAsc(Long memberId);
}
