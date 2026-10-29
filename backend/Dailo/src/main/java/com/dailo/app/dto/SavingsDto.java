package com.dailo.app.dto;

import com.dailo.app.entity.Savings;
import lombok.*;

import java.time.LocalDate;

public class SavingsDto {

    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class Request {
        private String name;
        private String bank;
        private Long monthlyAmount;
        private LocalDate startDate;
        private Integer months;
        private Float ratePct;
        private Boolean taxFree;
        private Integer paidOverride;
        private String memo;
        private String kind;
        private Long balanceOverride;
        private String region;
        private Boolean householdHead;
        private Long monthlyBonus;
        private Long bonusBalance;
    }

    @Getter @Builder
    public static class Response {
        private Long id;
        private String name;
        private String bank;
        private Long monthlyAmount;
        private LocalDate startDate;
        private Integer months;
        private Float ratePct;
        private Boolean taxFree;
        private Integer paidOverride;
        private String memo;
        private String kind;
        private Long balanceOverride;
        private String region;
        private Boolean householdHead;
        private Long monthlyBonus;
        private Long bonusBalance;

        public static Response from(Savings s) {
            return Response.builder()
                    .id(s.getId()).name(s.getName()).bank(s.getBank())
                    .monthlyAmount(s.getMonthlyAmount()).startDate(s.getStartDate()).months(s.getMonths())
                    .ratePct(s.getRatePct()).taxFree(s.getTaxFree()).paidOverride(s.getPaidOverride()).memo(s.getMemo())
                    .kind(s.kindOrDefault()).balanceOverride(s.getBalanceOverride()).region(s.getRegion())
                    .householdHead(Boolean.TRUE.equals(s.getHouseholdHead()))
                    .monthlyBonus(s.getMonthlyBonus()).bonusBalance(s.getBonusBalance())
                    .build();
        }
    }
}
