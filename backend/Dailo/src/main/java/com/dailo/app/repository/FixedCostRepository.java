package com.dailo.app.repository;

import com.dailo.app.entity.FixedCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FixedCostRepository extends JpaRepository<FixedCost, Long> {

    List<FixedCost> findByMemberIdAndIsActiveTrueOrderBySortOrderAsc(Long memberId);

    List<FixedCost> findByMemberIdOrderBySortOrderAsc(Long memberId);

    @Query("SELECT COALESCE(SUM(f.amount), 0) FROM FixedCost f WHERE f.member.id = :memberId AND f.isActive = true")
    Integer sumActiveByMemberId(@Param("memberId") Long memberId);
}