package com.dailo.app.repository;

import com.dailo.app.entity.InvestMonthlyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface InvestMonthlyRecordRepository extends JpaRepository<InvestMonthlyRecord, Long> {
    Optional<InvestMonthlyRecord> findByHoldingIdAndYearMonth(Long holdingId, String yearMonth);
    List<InvestMonthlyRecord> findByHoldingIdInAndYearMonth(List<Long> holdingIds, String yearMonth);

    @Query("SELECT r FROM InvestMonthlyRecord r WHERE r.holding.account.memberId = :memberId AND r.yearMonth LIKE :yearPrefix%")
    List<InvestMonthlyRecord> findByMemberIdAndYearPrefix(@Param("memberId") Long memberId, @Param("yearPrefix") String yearPrefix);

    @Query("SELECT COALESCE(SUM(r.actualAmt), 0) FROM InvestMonthlyRecord r WHERE r.holding.account.memberId = :memberId AND r.holding.account.type = 'PENSION' AND r.yearMonth LIKE :yearPrefix%")
    int sumPensionYtdActual(@Param("memberId") Long memberId, @Param("yearPrefix") String yearPrefix);

    void deleteByHoldingId(Long holdingId);
}