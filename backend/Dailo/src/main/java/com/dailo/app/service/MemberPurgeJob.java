package com.dailo.app.service;

import com.dailo.app.entity.Member;
import com.dailo.app.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

// 매일 새벽 4시 30분: 탈퇴 후 유예 기간(30일)이 지난 회원을 한 명씩 삭제 — 한 명 실패해도 나머지는 진행
@Slf4j
@Component
@RequiredArgsConstructor
public class MemberPurgeJob {

    private final MemberRepository memberRepository;
    private final MemberPurgeService memberPurgeService;

    @Scheduled(cron = "0 30 4 * * *", zone = "Asia/Seoul")
    public void purgeExpired() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(MemberService.WITHDRAW_GRACE_DAYS);
        for (Member m : memberRepository.findByDeletedAtBefore(cutoff)) {
            try {
                memberPurgeService.purge(m.getId());
            } catch (Exception e) {
                log.error("탈퇴 회원 {} 삭제 실패", m.getId(), e);
            }
        }
    }
}
