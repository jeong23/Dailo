package com.dailo.app.dto;

import com.dailo.app.entity.AllocationInputMode;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 가변 예산 분배 항목 요청
// - inputMode == RATE: budgetAmount는 서버가 available * rate로 계산 (rate 필드 사용)
// - inputMode == AMOUNT: budgetAmount는 서버가 amount 값을 그대로 저장 (재계산 금지, amount 필드 사용)
// - inputMode가 null이면 RATE로 기본 처리 (서비스단에서 처리)
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

    private AllocationInputMode inputMode;

    // AMOUNT 모드일 때 사용자가 입력한 금액 그대로 (재계산 없이 저장)
    // 프론트(parseNumber)는 '-' 부호를 제거해 음수를 막지만 API 직접 호출 시 우회 가능하므로 서버측에도 하한 검증 필요
    @Min(value = 0, message = "금액은 0 이상이어야 합니다.")
    private Integer amount;

    // 연결할 투자 계좌 id (본인 계좌만, null = 연결 없음)
    private Long investAccountId;

    // 연결할 적금·청약 id (본인 것만, null = 연결 없음) — investAccountId와 함께 오면 400
    private Long savingsId;
}
