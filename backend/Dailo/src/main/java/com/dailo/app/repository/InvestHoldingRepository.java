package com.dailo.app.repository;

import com.dailo.app.entity.InvestHolding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface InvestHoldingRepository extends JpaRepository<InvestHolding, Long> {
    List<InvestHolding> findByAccountIdOrderBySortOrderAsc(Long accountId);
    List<InvestHolding> findByAccountIdInOrderBySortOrderAsc(List<Long> accountIds);
    void deleteByAccountId(Long accountId);

    // 실시간 시세 구독 대상 — 전체 회원의 종목코드 (KIS 웹소켓 연결은 앱 전체에서 1개)
    @Query("SELECT DISTINCT h.stockCode FROM InvestHolding h WHERE h.stockCode IS NOT NULL")
    List<String> findAllStockCodes();

    // 회원별 시세 전달 범위 — 본인 종목 시세만 SSE로 보냄
    @Query("SELECT DISTINCT h.stockCode FROM InvestHolding h WHERE h.stockCode IS NOT NULL AND h.account.memberId = :memberId")
    List<String> findStockCodesByMemberId(@Param("memberId") Long memberId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE InvestHolding h SET h.themeId = null WHERE h.themeId = :themeId")
    void clearTheme(@Param("themeId") Long themeId);
}
