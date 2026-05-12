package com.dailo.app.repository;

import com.dailo.app.entity.HabitLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HabitLogRepository extends JpaRepository<HabitLog, Long> {
    List<HabitLog> findByHabitMemberIdAndLogDateBetween(Long memberId, LocalDate start, LocalDate end);
    Optional<HabitLog> findByHabitIdAndLogDate(Long habitId, LocalDate logDate);
    void deleteByHabitId(Long habitId);
}