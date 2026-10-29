package com.dailo.app.repository;

import com.dailo.app.entity.VisionBoardItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VisionBoardItemRepository extends JpaRepository<VisionBoardItem, Long> {
    List<VisionBoardItem> findByMemberIdOrderByZAsc(Long memberId);

    long countByMemberId(Long memberId);
}
