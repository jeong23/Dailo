package com.dailo.app.repository;

import com.dailo.app.entity.CashAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CashAccountRepository extends JpaRepository<CashAccount, Long> {

    List<CashAccount> findByMemberIdOrderBySortOrderAscIdAsc(Long memberId);

    Optional<CashAccount> findByIdAndMemberId(Long id, Long memberId);
}
