package com.dailo.app.service;

import com.dailo.app.dto.AllocationItemRequestDto;
import com.dailo.app.dto.MonthlyBudgetRequestDto;
import com.dailo.app.dto.MonthlyBudgetResponseDto;
import com.dailo.app.entity.BudgetAllocationItem;
import com.dailo.app.entity.Member;
import com.dailo.app.entity.MonthlyBudget;
import com.dailo.app.repository.BudgetAllocationItemRepository;
import com.dailo.app.repository.FixedCostRepository;
import com.dailo.app.repository.MemberRepository;
import com.dailo.app.repository.MonthlyBudgetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MonthlyBudgetService {

    private final MonthlyBudgetRepository monthlyBudgetRepository;
    private final MemberRepository memberRepository;
    private final FixedCostRepository fixedCostRepository;
    private final BudgetAllocationItemRepository budgetAllocationItemRepository;

    private static double safe(Double v) { return v != null ? v : 0.0; }

    // 고정 5항목(living/isa/pension/emergency/discretionary)만 계산 — 가변 항목은 buildAllocationItems()에서 별도 계산
    private int[] calcDistribution(Long memberId, Integer netSalary, MonthlyBudgetRequestDto req) {
        int fixedCostTotal = fixedCostRepository.sumActiveByMemberId(memberId);
        int available = Math.max(netSalary - fixedCostTotal, 0);
        return new int[]{
            fixedCostTotal,
            available,
            (int)(available * safe(req.getLivingRate())),
            (int)(available * safe(req.getIsaRate())),
            (int)(available * safe(req.getPensionRate())),
            (int)(available * safe(req.getEmergencyRate())),
            (int)(available * safe(req.getDiscretionaryRate()))
        };
    }

    // 가변 개수 예산 분배 항목을 available * rate로 계산해서 미저장 엔티티 리스트로 변환
    private List<BudgetAllocationItem> buildAllocationItems(MonthlyBudget budget, int available,
                                                             List<AllocationItemRequestDto> requestItems) {
        if (requestItems == null || requestItems.isEmpty()) {
            return Collections.emptyList();
        }

        // 같은 요청 안에 라벨이 중복되면 DB UNIQUE(monthly_budget_id, label) 위반으로 걸러지지만
        // 그 경우 GlobalExceptionHandler가 일반 메시지만 주므로, 원인이 드러나도록 여기서 먼저 검증한다.
        Set<String> seenLabels = new HashSet<>();
        for (AllocationItemRequestDto reqItem : requestItems) {
            if (!seenLabels.add(reqItem.getLabel())) {
                throw new IllegalArgumentException("중복된 항목명이 있습니다: " + reqItem.getLabel());
            }
        }

        List<BudgetAllocationItem> items = new ArrayList<>();
        int sortOrder = 1;
        for (AllocationItemRequestDto reqItem : requestItems) {
            double rate = safe(reqItem.getRate());
            items.add(BudgetAllocationItem.builder()
                    .monthlyBudget(budget)
                    .label(reqItem.getLabel())
                    .rate(rate)
                    .budgetAmount((int)(available * rate))
                    .sortOrder(sortOrder++)
                    .build());
        }
        return items;
    }

    @Transactional
    public MonthlyBudgetResponseDto create(Long memberId, MonthlyBudgetRequestDto request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + memberId));

        if (monthlyBudgetRepository.existsByMemberIdAndSettleMonth(memberId, request.getSettleMonth())) {
            throw new IllegalArgumentException("해당 월 예산이 이미 존재합니다: " + request.getSettleMonth());
        }

        int[] dist = calcDistribution(member.getId(), request.getNetSalary(), request);
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
                .livingRate(request.getLivingRate())
                .isaRate(request.getIsaRate())
                .pensionRate(request.getPensionRate())
                .emergencyRate(request.getEmergencyRate())
                .discretionaryRate(request.getDiscretionaryRate())
                .build();

        MonthlyBudget saved = monthlyBudgetRepository.save(budget);

        List<BudgetAllocationItem> items = buildAllocationItems(saved, dist[1], request.getAllocationItems());
        List<BudgetAllocationItem> savedItems = items.isEmpty()
                ? Collections.emptyList()
                : budgetAllocationItemRepository.saveAll(items);

        return MonthlyBudgetResponseDto.from(saved, savedItems);
    }

    public MonthlyBudgetResponseDto findById(Long memberId, Long id) {
        MonthlyBudget budget = monthlyBudgetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + id));
        validateOwnership(memberId, budget);
        List<BudgetAllocationItem> items = budgetAllocationItemRepository.findByMonthlyBudgetIdOrderBySortOrderAsc(id);
        return MonthlyBudgetResponseDto.from(budget, items);
    }

    public MonthlyBudgetResponseDto findByMemberAndMonth(Long memberId, String settleMonth) {
        MonthlyBudget budget = monthlyBudgetRepository.findByMemberIdAndSettleMonth(memberId, settleMonth)
                .orElseThrow(() -> new IllegalArgumentException("해당 월 예산을 찾을 수 없습니다: " + settleMonth));
        List<BudgetAllocationItem> items = budgetAllocationItemRepository.findByMonthlyBudgetIdOrderBySortOrderAsc(budget.getId());
        return MonthlyBudgetResponseDto.from(budget, items);
    }

    // N+1 방지: 달마다 allocationItems를 개별 조회하지 않고 전체 monthlyBudgetIds를 모아 IN절로 한 번에 조회 후 그룹핑 (InvestService.getDashboard() 패턴)
    public List<MonthlyBudgetResponseDto> findByMemberId(Long memberId) {
        List<MonthlyBudget> budgets = monthlyBudgetRepository.findByMemberIdOrderBySettleMonthDesc(memberId);
        if (budgets.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> budgetIds = budgets.stream().map(MonthlyBudget::getId).collect(Collectors.toList());
        Map<Long, List<BudgetAllocationItem>> itemsByBudgetId = budgetAllocationItemRepository
                .findByMonthlyBudgetIdIn(budgetIds).stream()
                .collect(Collectors.groupingBy(i -> i.getMonthlyBudget().getId()));

        return budgets.stream()
                .map(budget -> MonthlyBudgetResponseDto.from(
                        budget,
                        itemsByBudgetId.getOrDefault(budget.getId(), Collections.emptyList())))
                .collect(Collectors.toList());
    }

    @Transactional
    public MonthlyBudgetResponseDto update(Long memberId, Long id, MonthlyBudgetRequestDto request) {
        MonthlyBudget budget = monthlyBudgetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + id));
        validateOwnership(memberId, budget);

        int[] dist = calcDistribution(budget.getMember().getId(), request.getNetSalary(), request);

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
                request.getEmergencyCumulative(),
                request.getLivingRate(),
                request.getIsaRate(),
                request.getPensionRate(),
                request.getEmergencyRate(),
                request.getDiscretionaryRate()
        );

        // 전체 교체(replace-all) 패턴: 기존 항목 삭제(@Modifying 벌크 DELETE, flushAutomatically로 즉시 실행) 후 요청 리스트로 재삽입
        budgetAllocationItemRepository.deleteByMonthlyBudgetId(id);
        List<BudgetAllocationItem> items = buildAllocationItems(budget, dist[1], request.getAllocationItems());
        List<BudgetAllocationItem> savedItems = items.isEmpty()
                ? Collections.emptyList()
                : budgetAllocationItemRepository.saveAll(items);

        return MonthlyBudgetResponseDto.from(budget, savedItems);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        MonthlyBudget budget = monthlyBudgetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + id));
        validateOwnership(memberId, budget);
        budgetAllocationItemRepository.deleteByMonthlyBudgetId(id); // 자식 먼저
        monthlyBudgetRepository.deleteById(id);                    // 부모 나중
    }

    // 다른 회원의 예산 레코드에 접근하지 못하도록 소유자 검증 (IDOR 방지)
    // 존재 여부 노출을 최소화하기 위해 not-found와 동일한 메시지/상태코드(400)를 사용한다 (프로젝트 기존 컨벤션과 동일)
    private void validateOwnership(Long memberId, MonthlyBudget budget) {
        if (!budget.getMember().getId().equals(memberId)) {
            throw new IllegalArgumentException("월별 예산을 찾을 수 없습니다: " + budget.getId());
        }
    }
}
