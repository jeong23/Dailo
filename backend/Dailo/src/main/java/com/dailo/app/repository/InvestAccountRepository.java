package com.dailo.app.repository;

import com.dailo.app.entity.InvestAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InvestAccountRepository extends JpaRepository<InvestAccount, Long> {
    List<InvestAccount> findByMemberIdOrderBySortOrderAsc(Long memberId);
    void deleteByMemberId(Long memberId);
}