package com.dailo.app.repository;

import com.dailo.app.entity.Savings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavingsRepository extends JpaRepository<Savings, Long> {
    List<Savings> findByMemberIdOrderByStartDateAsc(Long memberId);
}
