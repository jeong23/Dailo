package com.dailo.app.service;

import com.dailo.app.dto.AssetSnapshotDto;
import com.dailo.app.entity.AssetSnapshot;
import com.dailo.app.entity.Member;
import com.dailo.app.repository.AssetSnapshotRepository;
import com.dailo.app.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

// 월말 순자산 스냅샷 — 이번 정산월 한 줄을 덮어씀. 지난 달은 그 달 마지막 기록 그대로 남음
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssetSnapshotService {

    static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final AssetSnapshotRepository repository;
    private final MemberRepository memberRepository;
    Clock clock = Clock.system(KST); // 테스트에서 바꿈

    public List<AssetSnapshotDto.Response> findAll(Long memberId) {
        return repository.findByMemberIdOrderBySettleMonthAsc(memberId).stream().map(AssetSnapshotDto.Response::from).toList();
    }

    @Transactional
    public AssetSnapshotDto.Response recordCurrent(Long memberId, AssetSnapshotDto.Request req) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다"));
        LocalDateTime now = LocalDateTime.now(clock.withZone(KST));
        // 프론트 getCurrentSettleMonth와 같은 규칙 (월급일 이후면 다음 달)
        String month = CashFlow.settleMonthOf(now.toLocalDate(), member.getSalaryDay() == null ? 25 : member.getSalaryDay());

        AssetSnapshot snap = repository.findByMemberIdAndSettleMonth(memberId, month)
                .orElseGet(() -> AssetSnapshot.builder().memberId(memberId).settleMonth(month)
                        .cash(0L).invest(0L).savings(0L).manual(0L).capturedAt(now).build());
        snap.record(req.getCash(), req.getInvest(), req.getSavings(), req.getManual(), now);
        return AssetSnapshotDto.Response.from(repository.save(snap));
    }
}
