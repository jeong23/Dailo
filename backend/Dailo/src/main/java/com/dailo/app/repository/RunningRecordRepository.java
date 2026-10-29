package com.dailo.app.repository;

import com.dailo.app.entity.RunningRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RunningRecordRepository extends JpaRepository<RunningRecord, Long> {
    Optional<RunningRecord> findByMemberIdAndRunDate(Long memberId, LocalDate runDate);
    List<RunningRecord> findByMemberIdAndRunDateBetweenOrderByRunDateAsc(Long memberId, LocalDate from, LocalDate to);
}
