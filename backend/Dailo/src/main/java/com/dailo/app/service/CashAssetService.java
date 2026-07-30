package com.dailo.app.service;

import com.dailo.app.dto.CashAssetRequestDto;
import com.dailo.app.dto.CashAssetResponseDto;
import com.dailo.app.entity.CashAsset;
import com.dailo.app.repository.CashAssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CashAssetService {

    private final CashAssetRepository cashAssetRepository;

    public List<CashAssetResponseDto> getHistory(Long memberId) {
        return cashAssetRepository.findByMemberIdOrderBySettleMonthAsc(memberId).stream()
                .map(CashAssetResponseDto::from)
                .collect(Collectors.toList());
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
