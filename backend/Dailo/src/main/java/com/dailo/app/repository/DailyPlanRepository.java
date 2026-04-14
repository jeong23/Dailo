package com.dailo.app.repository;

import com.dailo.app.entity.DailyPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyPlanRepository extends JpaRepository<DailyPlan, Long> {
    Optional<DailyPlan> findByPlanDate(LocalDate planDate);
    List<DailyPlan> findByPlanDateBetweenOrderByPlanDateAsc(LocalDate start, LocalDate end);
}
