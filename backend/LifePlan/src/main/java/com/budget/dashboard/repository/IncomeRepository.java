package com.budget.dashboard.repository;

import com.budget.dashboard.entity.Income;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface IncomeRepository extends JpaRepository<Income, Long> {

    List<Income> findBySettleMonthOrderByIncomeDateDesc(String settleMonth);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM Income i WHERE i.settleMonth = :settleMonth")
    Integer sumBySettleMonth(@Param("settleMonth") String settleMonth);
}
