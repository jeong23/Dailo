package com.dailo.app.service;

import com.dailo.app.dto.FixedCostRequestDto;
import com.dailo.app.dto.FixedCostResponseDto;
import com.dailo.app.entity.FixedCost;
import com.dailo.app.entity.Member;
import com.dailo.app.repository.FixedCostRepository;
import com.dailo.app.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FixedCostService {

    private final FixedCostRepository fixedCostRepository;
    private final MemberRepository memberRepository;

    @Transactional
    public FixedCostResponseDto create(Long memberId, FixedCostRequestDto request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + memberId));

        FixedCost fixedCost = FixedCost.builder()
                .member(member)
                .name(request.getName())
                .amount(request.getAmount())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .sortOrder(request.getSortOrder())
                .build();
        applySchedule(fixedCost, request);

        return FixedCostResponseDto.from(fixedCostRepository.save(fixedCost));
    }

    public FixedCostResponseDto findById(Long memberId, Long id) {
        return FixedCostResponseDto.from(findOwned(memberId, id));
    }

    public List<FixedCostResponseDto> findByMemberId(Long memberId) {
        return fixedCostRepository.findByMemberIdOrderByAmountDesc(memberId).stream()
                .map(FixedCostResponseDto::from)
                .collect(Collectors.toList());
    }

    public List<FixedCostResponseDto> findActiveByMemberId(Long memberId) {
        return fixedCostRepository.findByMemberIdAndIsActiveTrueOrderByAmountDesc(memberId).stream()
                .map(FixedCostResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public FixedCostResponseDto update(Long memberId, Long id, FixedCostRequestDto request) {
        FixedCost fixedCost = findOwned(memberId, id);

        fixedCost.update(request.getName(), request.getAmount(), request.getIsActive(), request.getSortOrder());
        applySchedule(fixedCost, request);
        return FixedCostResponseDto.from(fixedCost);
    }

    private void applySchedule(FixedCost fixedCost, FixedCostRequestDto request) {
        if (FixedCost.INSTALLMENT.equals(request.getCostType())) {
            if (request.getInstallmentStart() == null) {
                throw new IllegalArgumentException("할부 첫 결제일을 입력해주세요.");
            }
            if (request.getInstallmentMonths() == null || request.getInstallmentMonths() < 1 || request.getInstallmentMonths() > 120) {
                throw new IllegalArgumentException("할부 개월 수는 1~120 사이로 입력해주세요.");
            }
        }
        fixedCost.updateSchedule(request.getCostType(), request.getInstallmentStart(), request.getInstallmentMonths());
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        fixedCostRepository.delete(findOwned(memberId, id));
    }

    private FixedCost findOwned(Long memberId, Long id) {
        FixedCost fixedCost = fixedCostRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("고정비를 찾을 수 없습니다: " + id));
        // 다른 회원의 고정비 조회·수정·삭제 방지 (IDOR) — 존재 여부가 드러나지 않게 같은 메시지
        if (!fixedCost.getMember().getId().equals(memberId)) {
            throw new IllegalArgumentException("고정비를 찾을 수 없습니다: " + id);
        }
        return fixedCost;
    }
}