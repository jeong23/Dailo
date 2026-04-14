package com.dailo.app.repository;

import com.dailo.app.entity.TimeBoxSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TimeBoxSlotRepository extends JpaRepository<TimeBoxSlot, Long> {
    List<TimeBoxSlot> findByPlanDateOrderByHourAsc(LocalDate planDate);
    Optional<TimeBoxSlot> findByPlanDateAndHour(LocalDate planDate, Integer hour);
}
