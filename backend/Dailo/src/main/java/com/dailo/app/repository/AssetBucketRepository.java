package com.dailo.app.repository;

import com.dailo.app.entity.AssetBucket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssetBucketRepository extends JpaRepository<AssetBucket, Long> {
    List<AssetBucket> findByMemberIdOrderBySortOrderAsc(Long memberId);
}
