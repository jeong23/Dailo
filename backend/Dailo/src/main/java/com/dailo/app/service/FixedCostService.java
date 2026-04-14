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
    public FixedCostResponseDto create(FixedCostRequestDto request) {
        Member member = memberRepository.findById(request.getMemberId())
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + request.getMemberId()));

        FixedCost fixedCost = FixedCost.builder()
                .member(member)
                .name(request.getName())
                .amount(request.getAmount())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .sortOrder(request.getSortOrder())
                .build();

        return FixedCostResponseDto.from(fixedCostRepository.save(fixedCost));
    }

    public FixedCostResponseDto findById(Long id) {
        FixedCost fixedCost = fixedCostRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("고정비를 찾을 수 없습니다: " + id));
        return FixedCostResponseDto.from(fixedCost);
    }

    public List<FixedCostResponseDto> findByMemberId(Long memberId) {
        return fixedCostRepository.findByMemberIdOrderBySortOrderAsc(memberId).stream()
                .map(FixedCostResponseDto::from)
                .collect(Collectors.toList());
    }

    public List<FixedCostResponseDto> findActiveByMemberId(Long memberId) {
        return fixedCostRepository.findByMemberIdAndIsActiveTrueOrderBySortOrderAsc(memberId).stream()
                .map(FixedCostResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public FixedCostResponseDto update(Long id, FixedCostRequestDto request) {
        FixedCost fixedCost = fixedCostRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("고정비를 찾을 수 없습니다: " + id));

        fixedCost.update(request.getName(), request.getAmount(), request.getIsActive(), request.getSortOrder());
        return FixedCostResponseDto.from(fixedCost);
    }

    @Transactional
    public void delete(Long id) {
        if (!fixedCostRepository.existsById(id)) {
            throw new IllegalArgumentException("고정비를 찾을 수 없습니다: " + id);
        }
        fixedCostRepository.deleteById(id);
    }
}