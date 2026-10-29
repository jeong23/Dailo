package com.dailo.app.repository;

import com.dailo.app.entity.InvestTheme;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvestThemeRepository extends JpaRepository<InvestTheme, Long> {
    List<InvestTheme> findByMemberIdOrderBySortOrderAsc(Long memberId);
}
