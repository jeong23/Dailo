package com.dailo.app.repository;

import com.dailo.app.entity.RunningGoal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RunningGoalRepository extends JpaRepository<RunningGoal, Long> {
    Optional<RunningGoal> findByMemberIdAndYearAndMonth(Long memberId, Integer year, Integer month);
}
