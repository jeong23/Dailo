package com.dailo.app.service;

import com.dailo.app.dto.CashAssetRequestDto;
import com.dailo.app.dto.CashAssetResponseDto;
import com.dailo.app.entity.CashAsset;
import com.dailo.app.repository.CashAssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CashAssetService {

    private final CashAssetRepository cashAssetRepository;
    private final CashBalanceService balanceService;

    // 현금 계좌가 있으면 기준 잔액 달부터는 계산값(auto)으로 덮어씀 — 지출·수입이 바로 추이·자산 현황에 반영
    //  그 전 달은 저장된 기록 그대로
    public List<CashAssetResponseDto> getHistory(Long memberId, String settleMonth) {
        Map<String, CashAssetResponseDto> byMonth = new LinkedHashMap<>();
        cashAssetRepository.findByMemberIdOrderBySettleMonthAsc(memberId)
                .forEach(c -> byMonth.put(c.getSettleMonth(), CashAssetResponseDto.from(c)));
        balanceService.compute(memberId, settleMonth).monthEnd().forEach((month, total) -> {
            CashAssetResponseDto stored = byMonth.get(month);
            byMonth.put(month, CashAssetResponseDto.builder()
                    .id(stored != null ? stored.getId() : null).settleMonth(month)
                    .balance((int) Math.max(Math.min(total, Integer.MAX_VALUE), Integer.MIN_VALUE))
                    .memo(stored != null ? stored.getMemo() : null).auto(true).build());
        });
        List<CashAssetResponseDto> list = new ArrayList<>(byMonth.values());
        list.sort(Comparator.comparing(CashAssetResponseDto::getSettleMonth));
        return list;
    }

    @Transactional
    public CashAssetResponseDto upsert(Long memberId, CashAssetRequestDto req) {
        CashAsset cashAsset = cashAssetRepository.findByMemberIdAndSettleMonth(memberId, req.getSettleMonth())
                .orElse(null);
        if (cashAsset == null) {
            cashAsset = cashAssetRepository.save(CashAsset.builder()
                    .memberId(memberId)
                    .settleMonth(req.getSettleMonth())
                    .balance(req.getBalance())
                    .livingSurplusApplied(req.getLivingSurplusApplied())
                    .memo(req.getMemo())
                    .build());
        } else {
            Integer livingSurplusApplied = req.getLivingSurplusApplied() != null
                    ? req.getLivingSurplusApplied()
                    : cashAsset.getLivingSurplusApplied();
            cashAsset.update(req.getBalance(), livingSurplusApplied, req.getMemo());
        }
        return CashAssetResponseDto.from(cashAsset);
    }
}
