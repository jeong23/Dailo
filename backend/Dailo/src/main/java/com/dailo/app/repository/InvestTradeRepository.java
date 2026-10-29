package com.dailo.app.repository;

import com.dailo.app.entity.InvestTrade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InvestTradeRepository extends JpaRepository<InvestTrade, Long> {
    List<InvestTrade> findByMemberIdAndTradeDateBetweenOrderByIdDesc(Long memberId, LocalDate from, LocalDate to);
    Optional<InvestTrade> findTopByHoldingIdOrderByIdDesc(Long holdingId);
}
