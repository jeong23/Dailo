package com.budget.dashboard.repository;

import com.budget.dashboard.entity.MonthlyBudget;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonthlyBudgetRepository extends JpaRepository<MonthlyBudget, Long> {

    Optional<MonthlyBudget> findByMemberIdAndSettleMonth(Long memberId, String settleMonth);

    List<MonthlyBudget> findByMemberIdOrderBySettleMonthDesc(Long memberId);

    List<MonthlyBudget> findByMemberIdOrderBySettleMonthAsc(Long memberId);

    boolean existsByMemberIdAndSettleMonth(Long memberId, String settleMonth);

    Optional<MonthlyBudget> findBySettleMonth(String settleMonth);
}