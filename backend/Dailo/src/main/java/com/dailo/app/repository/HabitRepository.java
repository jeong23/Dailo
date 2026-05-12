package com.dailo.app.repository;

import com.dailo.app.entity.Habit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HabitRepository extends JpaRepository<Habit, Long> {
    List<Habit> findByMemberIdAndIsActiveTrueOrderBySortOrderAsc(Long memberId);
}