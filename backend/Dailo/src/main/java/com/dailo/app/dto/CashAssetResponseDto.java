package com.dailo.app.dto;

import com.dailo.app.entity.CashAsset;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class CashAssetResponseDto {

    private Long id;
    private String settleMonth;
    private Integer balance;
    private String memo;
    // true = 현금 계좌 기준 잔액 + 지출·수입·월급·고정비로 계산한 값 (저장된 값 아님)
    private boolean auto;

    public static CashAssetResponseDto from(CashAsset cashAsset) {
        return CashAssetResponseDto.builder()
                .id(cashAsset.getId())
                .settleMonth(cashAsset.getSettleMonth())
                .balance(cashAsset.getBalance())
                .memo(cashAsset.getMemo())
                .build();
    }
}
