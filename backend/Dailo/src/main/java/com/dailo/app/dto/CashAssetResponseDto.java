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

    public static CashAssetResponseDto from(CashAsset cashAsset) {
        return CashAssetResponseDto.builder()
                .id(cashAsset.getId())
                .settleMonth(cashAsset.getSettleMonth())
                .balance(cashAsset.getBalance())
                .memo(cashAsset.getMemo())
                .build();
    }
}
