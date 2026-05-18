package com.dailo.app.repository;

import com.dailo.app.entity.InvestSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface InvestSettingRepository extends JpaRepository<InvestSetting, Long> {
    Optional<InvestSetting> findByMemberId(Long memberId);
}