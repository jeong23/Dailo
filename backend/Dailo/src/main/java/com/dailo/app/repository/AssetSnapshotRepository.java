package com.dailo.app.repository;

import com.dailo.app.entity.AssetSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssetSnapshotRepository extends JpaRepository<AssetSnapshot, Long> {
    List<AssetSnapshot> findByMemberIdOrderBySettleMonthAsc(Long memberId);

    Optional<AssetSnapshot> findByMemberIdAndSettleMonth(Long memberId, String settleMonth);
}
