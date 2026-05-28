package com.dailo.app.repository;

import com.dailo.app.entity.InvestHolding;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InvestHoldingRepository extends JpaRepository<InvestHolding, Long> {
    List<InvestHolding> findByAccountIdOrderBySortOrderAsc(Long accountId);
    List<InvestHolding> findByAccountIdInOrderBySortOrderAsc(List<Long> accountIds);
    void deleteByAccountId(Long accountId);
}