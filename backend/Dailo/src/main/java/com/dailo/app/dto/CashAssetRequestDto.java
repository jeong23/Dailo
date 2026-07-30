package com.dailo.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CashAssetRequestDto {

    @NotBlank(message = "정산월은 필수입니다")
    @Pattern(regexp = "\\d{4}-(0[1-9]|1[0-2])", message = "정산월 형식이 올바르지 않습니다 (예: 2026-07)")
    private String settleMonth;

    @NotNull(message = "잔액은 필수입니다")
    private Integer balance;

    private Integer livingSurplusApplied;

    @Size(max = 200, message = "메모는 200자 이내로 입력해주세요")
    private String memo;
}
