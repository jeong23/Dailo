package com.dailo.app.repository;

import com.dailo.app.entity.TimeBoxSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TimeBoxSlotRepository extends JpaRepository<TimeBoxSlot, Long> {
    List<TimeBoxSlot> findByMemberIdAndPlanDateOrderByHourAsc(Long memberId, LocalDate planDate);
    Optional<TimeBoxSlot> findByMemberIdAndPlanDateAndHour(Long memberId, LocalDate planDate, Integer hour);
}
