package com.dailo.app.repository;

import com.dailo.app.entity.TimeBoxBlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface TimeBoxBlockRepository extends JpaRepository<TimeBoxBlock, Long> {
    List<TimeBoxBlock> findByPlanDateOrderByStartHourAscStartSlotAsc(LocalDate planDate);
}
