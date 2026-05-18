package com.dailo.app.repository;

import com.dailo.app.entity.InvestDiary;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InvestDiaryRepository extends JpaRepository<InvestDiary, Long> {
    List<InvestDiary> findByMemberIdAndDateBetweenOrderByDateDesc(Long memberId, LocalDate start, LocalDate end);
    Optional<InvestDiary> findByMemberIdAndDate(Long memberId, LocalDate date);
}