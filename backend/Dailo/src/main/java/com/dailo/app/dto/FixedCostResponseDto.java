package com.dailo.app.dto;

import com.dailo.app.entity.FixedCost;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.YearMonth;

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
    private String costType;            // RECURRING | INSTALLMENT
    private LocalDate installmentStart;
    private Integer installmentMonths;
    private LocalDate installmentEnd;
    private Integer paidMonths;         // 오늘까지 결제일이 지난 회차 수
    private Integer remainingMonths;    // 남은 회차 수 (오늘 이후 결제일)
    private String installmentStatus;   // UPCOMING(시작 전) | ONGOING(이번 달 결제 있음) | DONE(완납)
    private Boolean countedThisMonth;   // 이번 달 고정비 합계에 포함되는지 (FixedCostRepository.sumActiveByMemberId와 동일 기준)

    public static FixedCostResponseDto from(FixedCost fixedCost) {
        FixedCostResponseDtoBuilder b = FixedCostResponseDto.builder()
                .id(fixedCost.getId())
                .memberId(fixedCost.getMember().getId())
                .name(fixedCost.getName())
                .amount(fixedCost.getAmount())
                .isActive(fixedCost.getIsActive())
                .sortOrder(fixedCost.getSortOrder());

        boolean active = Boolean.TRUE.equals(fixedCost.getIsActive());
        if (!fixedCost.isInstallment() || fixedCost.getInstallmentStart() == null) {
            return b.costType(FixedCost.RECURRING).countedThisMonth(active).build();
        }

        LocalDate today = LocalDate.now();
        LocalDate start = fixedCost.getInstallmentStart();
        int total = fixedCost.getInstallmentMonths();
        int paid = 0;
        while (paid < total && !start.plusMonths(paid).isAfter(today)) paid++;

        YearMonth now = YearMonth.from(today);
        String status;
        if (start.isAfter(now.atEndOfMonth())) status = "UPCOMING";
        else if (fixedCost.getInstallmentEnd().isBefore(now.atDay(1))) status = "DONE";
        else status = "ONGOING";

        return b.costType(FixedCost.INSTALLMENT)
                .installmentStart(start)
                .installmentMonths(total)
                .installmentEnd(fixedCost.getInstallmentEnd())
                .paidMonths(paid)
                .remainingMonths(total - paid)
                .installmentStatus(status)
                .countedThisMonth(active && "ONGOING".equals(status))
                .build();
    }
}
