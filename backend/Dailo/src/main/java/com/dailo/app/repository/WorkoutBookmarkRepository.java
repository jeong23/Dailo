package com.dailo.app.repository;

import com.dailo.app.entity.WorkoutBookmark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkoutBookmarkRepository extends JpaRepository<WorkoutBookmark, Long> {
    List<WorkoutBookmark> findByMemberIdOrderByIdAsc(Long memberId);
    Optional<WorkoutBookmark> findByMemberIdAndExerciseName(Long memberId, String exerciseName);
}
