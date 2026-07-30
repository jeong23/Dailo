package com.dailo.app.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 가변 예산 분배 항목 요청 — budgetAmount는 서버가 available * rate로 계산하므로 요청에 포함하지 않는다.
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AllocationItemRequestDto {

    @NotBlank(message = "항목명을 입력해주세요.")
    @Size(max = 50, message = "항목명은 50자 이내여야 합니다.")
    private String label;

    @DecimalMin(value = "0.0", message = "비율은 0 이상이어야 합니다.")
    @DecimalMax(value = "1.0", message = "비율은 1 이하여야 합니다.")
    private Double rate;
}
