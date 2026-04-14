package com.dailo.app.dto;

import com.dailo.app.entity.FixedCost;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class FixedCostResponseDto {

    private Long id;
    private Long memberId;
    private String name;
    private Integer amount;
    private Boolean isActive;
    private Integer sortOrder;

    public static FixedCostResponseDto from(FixedCost fixedCost) {
        return FixedCostResponseDto.builder()
                .id(fixedCost.getId())
                .memberId(fixedCost.getMember().getId())
                .name(fixedCost.getName())
                .amount(fixedCost.getAmount())
                .isActive(fixedCost.getIsActive())
                .sortOrder(fixedCost.getSortOrder())
                .build();
    }
}