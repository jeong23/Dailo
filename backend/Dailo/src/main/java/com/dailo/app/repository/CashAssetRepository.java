package com.dailo.app.repository;

import com.dailo.app.entity.CashAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CashAssetRepository extends JpaRepository<CashAsset, Long> {

    List<CashAsset> findByMemberIdOrderBySettleMonthAsc(Long memberId);

    Optional<CashAsset> findByMemberIdAndSettleMonth(Long memberId, String settleMonth);

    boolean existsByMemberIdAndSettleMonth(Long memberId, String settleMonth);

    void deleteByMemberId(Long memberId);
}
