package com.budget.dashboard.service;

import com.budget.dashboard.dto.MonthlyBudgetRequestDto;
import com.budget.dashboard.dto.MonthlyBudgetResponseDto;
import com.budget.dashboard.entity.Member;
import com.budget.dashboard.entity.MonthlyBudget;
import com.budget.dashboard.repository.FixedCostRepository;
import com.budget.dashboard.repository.MemberRepository;
import com.budget.dashboard.repository.MonthlyBudgetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MonthlyBudgetService {

    private final MonthlyBudgetRepository monthlyBudgetRepository;
    private final MemberRepository memberRepository;
    private final FixedCostRepository fixedCostRepository;

    private int[] calcDistribution(Long memberId, Integer netSalary) {
        int fixedCostTotal = fixedCostRepository.sumActiveByMemberId(memberId);
        int available = Math.max(netSalary - fixedCostTotal, 0);
        return new int[]{
            fixedCostTotal,
            available,
            (int)(available * 0.35),
            (int)(available * 0.25),
            (int)(available * 0.15),
            (int)(available * 0.15),
            (int)(available * 0.10)
        };
    }

    @Transactional
    public MonthlyBudgetResponseDto create(MonthlyBudgetRequestDto request) {
        Member member = memberRepository.findById(request.getMemberId())
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + request.getMemberId()));

        if (monthlyBudgetRepository.existsByMemberIdAndSettleMonth(request.getMemberId(), request.getSettleMonth())) {
            throw new IllegalArgumentException("해당 월 예산이 이미 존재합니다: " + request.getSettleMonth());
        }

        int[] dist = calcDistribution(member.getId(), request.getNetSalary());
        // dist: [fixedCostTotal, available, living, isa, pension, emergency, discretionary]

        MonthlyBudget budget = MonthlyBudget.builder()
                .member(member)
                .settleMonth(request.getSettleMonth())
                .netSalary(request.getNetSalary())
                .fixedCostTotal(dist[0])
                .availableAmount(dist[1])
                .livingBudget(dist[2])
                .isaAmount(dist[3])
                .pensionAmount(dist[4])
                .emergencyBudget(dist[5])
                .discretionaryBudget(dist[6])
                .cardGoal(request.getCardGoal())
                .livingCarryover(request.getLivingCarryover())
                .emergencyCumulative(request.getEmergencyCumulative())
                .build();

        return MonthlyBudgetResponseDto.from(monthlyBudgetRepository.save(budget));
    }

    public MonthlyBudgetResponseDto findById(Long id) {
        MonthlyBudget budget = monthlyBudgetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + id));
        return MonthlyBudgetResponseDto.from(budget);
    }

    public MonthlyBudgetResponseDto findByMemberAndMonth(Long memberId, String settleMonth) {
        MonthlyBudget budget = monthlyBudgetRepository.findByMemberIdAndSettleMonth(memberId, settleMonth)
                .orElseThrow(() -> new IllegalArgumentException("해당 월 예산을 찾을 수 없습니다: " + settleMonth));
        return MonthlyBudgetResponseDto.from(budget);
    }

    public List<MonthlyBudgetResponseDto> findByMemberId(Long memberId) {
        return monthlyBudgetRepository.findByMemberIdOrderBySettleMonthDesc(memberId).stream()
                .map(MonthlyBudgetResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public MonthlyBudgetResponseDto update(Long id, MonthlyBudgetRequestDto request) {
        MonthlyBudget budget = monthlyBudgetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + id));

        int[] dist = calcDistribution(budget.getMember().getId(), request.getNetSalary());

        budget.update(
                request.getNetSalary(),
                dist[0],
                dist[1],
                dist[2],
                dist[3],
                dist[4],
                dist[5],
                dist[6],
                request.getCardGoal(),
                request.getLivingCarryover(),
                request.getEmergencyCumulative()
        );

        return MonthlyBudgetResponseDto.from(budget);
    }

    @Transactional
    public void delete(Long id) {
        if (!monthlyBudgetRepository.existsById(id)) {
            throw new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + id);
        }
        monthlyBudgetRepository.deleteById(id);
    }
}