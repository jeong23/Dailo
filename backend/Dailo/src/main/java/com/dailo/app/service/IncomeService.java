package com.dailo.app.service;

import com.dailo.app.dto.IncomeRequestDto;
import com.dailo.app.dto.IncomeResponseDto;
import com.dailo.app.entity.Income;
import com.dailo.app.entity.Member;
import com.dailo.app.repository.CashAccountRepository;
import com.dailo.app.repository.IncomeRepository;
import com.dailo.app.repository.MemberRepository;
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
    private final CashAccountRepository cashAccountRepository;

    @Transactional
    // 회원은 로그인 정보로만 정함 — 요청 body의 memberId는 무시 (남의 이름으로 등록 방지)
    public IncomeResponseDto create(Long memberId, IncomeRequestDto request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + memberId));

        Income income = Income.builder()
                .member(member)
                .amount(request.getAmount())
                .incomeDate(request.getIncomeDate())
                .settleMonth(request.getSettleMonth())
                .source(request.getSource())
                .memo(request.getMemo())
                .cashAccountId(ownedCashAccount(memberId, request.getCashAccountId()))
                .build();

        return IncomeResponseDto.from(incomeRepository.save(income));
    }

    public List<IncomeResponseDto> findBySettleMonth(Long memberId, String settleMonth) {
        return incomeRepository.findByMemberIdAndSettleMonthOrderByIncomeDateDesc(memberId, settleMonth).stream()
                .map(IncomeResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public IncomeResponseDto update(Long memberId, Long id, IncomeRequestDto request) {
        Income income = findOwned(memberId, id);

        income.update(
                request.getAmount(),
                request.getIncomeDate(),
                request.getSettleMonth(),
                request.getSource(),
                request.getMemo(),
                ownedCashAccount(memberId, request.getCashAccountId())
        );

        return IncomeResponseDto.from(income);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        incomeRepository.delete(findOwned(memberId, id));
    }

    // 남의 현금 계좌에 연결 방지 (null = 기본 계좌)
    private Long ownedCashAccount(Long memberId, Long cashAccountId) {
        if (cashAccountId == null) return null;
        return cashAccountRepository.findByIdAndMemberId(cashAccountId, memberId)
                .orElseThrow(() -> new IllegalArgumentException("현금 계좌를 찾을 수 없습니다: " + cashAccountId)).getId();
    }

    // 다른 회원 수입 수정·삭제 방지 (IDOR) — 존재 여부가 드러나지 않게 같은 메시지
    private Income findOwned(Long memberId, Long id) {
        Income income = incomeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("수입을 찾을 수 없습니다: " + id));
        if (!income.getMember().getId().equals(memberId)) {
            throw new IllegalArgumentException("수입을 찾을 수 없습니다: " + id);
        }
        return income;
    }
}
