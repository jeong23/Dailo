package com.dailo.app.repository;

import com.dailo.app.entity.DailyPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyPlanRepository extends JpaRepository<DailyPlan, Long> {
    Optional<DailyPlan> findByMemberIdAndPlanDate(Long memberId, LocalDate planDate);
    List<DailyPlan> findByMemberIdAndPlanDateBetweenOrderByPlanDateAsc(Long memberId, LocalDate start, LocalDate end);
}
