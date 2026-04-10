package com.budget.dashboard.service;

import com.budget.dashboard.dto.IncomeRequestDto;
import com.budget.dashboard.dto.IncomeResponseDto;
import com.budget.dashboard.entity.Income;
import com.budget.dashboard.entity.Member;
import com.budget.dashboard.repository.IncomeRepository;
import com.budget.dashboard.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IncomeService {

    private final IncomeRepository incomeRepository;
    private final MemberRepository memberRepository;

    @Transactional
    public IncomeResponseDto create(IncomeRequestDto request) {
        Member member = memberRepository.findById(request.getMemberId())
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + request.getMemberId()));

        Income income = Income.builder()
                .member(member)
                .amount(request.getAmount())
                .incomeDate(request.getIncomeDate())
                .settleMonth(request.getSettleMonth())
                .source(request.getSource())
                .memo(request.getMemo())
                .build();

        return IncomeResponseDto.from(incomeRepository.save(income));
    }

    public List<IncomeResponseDto> findBySettleMonth(String settleMonth) {
        return incomeRepository.findBySettleMonthOrderByIncomeDateDesc(settleMonth).stream()
                .map(IncomeResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public IncomeResponseDto update(Long id, IncomeRequestDto request) {
        Income income = incomeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("수입을 찾을 수 없습니다: " + id));

        income.update(
                request.getAmount(),
                request.getIncomeDate(),
                request.getSettleMonth(),
                request.getSource(),
                request.getMemo()
        );

        return IncomeResponseDto.from(income);
    }

    @Transactional
    public void delete(Long id) {
        if (!incomeRepository.existsById(id)) {
            throw new IllegalArgumentException("수입을 찾을 수 없습니다: " + id);
        }
        incomeRepository.deleteById(id);
    }
}
