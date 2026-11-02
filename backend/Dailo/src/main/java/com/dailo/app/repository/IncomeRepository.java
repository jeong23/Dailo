package com.dailo.app.repository;

import com.dailo.app.entity.Income;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface IncomeRepository extends JpaRepository<Income, Long> {

    // settleMonth는 회원 간 유니크가 아님 — 항상 memberId와 같이 조회 (IDOR)
    List<Income> findByMemberIdAndSettleMonthOrderByIncomeDateDesc(Long memberId, String settleMonth);

    // 현금 잔액 계산용 — 기준 잔액 달부터
    List<Income> findByMemberIdAndSettleMonthGreaterThanEqual(Long memberId, String settleMonth);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i WHERE i.member.id = :memberId AND i.settleMonth = :settleMonth")
    Integer sumByMemberIdAndSettleMonth(@Param("memberId") Long memberId, @Param("settleMonth") String settleMonth);

    // 리포트용 정산월별 수입 합계 — [settleMonth, 합계]
    @Query("SELECT i.settleMonth, COALESCE(SUM(i.amount), 0) FROM Income i WHERE i.member.id = :memberId GROUP BY i.settleMonth")
    java.util.List<Object[]> sumByMonth(@Param("memberId") Long memberId);
}
