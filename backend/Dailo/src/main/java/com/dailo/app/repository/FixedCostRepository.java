package com.dailo.app.repository;

import com.dailo.app.entity.FixedCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

public interface FixedCostRepository extends JpaRepository<FixedCost, Long> {

    List<FixedCost> findByMemberIdAndIsActiveTrueOrderByAmountDesc(Long memberId);

    List<FixedCost> findByMemberIdOrderByAmountDesc(Long memberId);

    // 활성 고정비 합계 — 할부는 해당 달에 결제가 있는 것만 (시작 전·완납 제외)
    @Query("SELECT COALESCE(SUM(f.amount), 0) FROM FixedCost f WHERE f.member.id = :memberId AND f.isActive = true " +
           "AND (f.costType IS NULL OR f.costType <> 'INSTALLMENT' " +
           "OR (f.installmentStart <= :monthEnd AND f.installmentEnd >= :monthStart))")
    Integer sumActiveByMemberIdForMonth(@Param("memberId") Long memberId,
                                        @Param("monthStart") LocalDate monthStart,
                                        @Param("monthEnd") LocalDate monthEnd);

    default Integer sumActiveByMemberId(Long memberId) {
        YearMonth now = YearMonth.now();
        return sumActiveByMemberIdForMonth(memberId, now.atDay(1), now.atEndOfMonth());
    }
}