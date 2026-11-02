package com.dailo.app.dto;

import com.dailo.app.entity.Savings;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

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
        private List<PaymentRecord> records;   // 납입 지출 기록 (지출 화면에서 이 적금으로 적은 것)

        public static Response from(Savings s) {
            return from(s, List.of());
        }

        public static Response from(Savings s, List<PaymentRecord> records) {
            return Response.builder()
                    .id(s.getId()).name(s.getName()).bank(s.getBank())
                    .monthlyAmount(s.getMonthlyAmount()).startDate(s.getStartDate()).months(s.getMonths())
                    .ratePct(s.getRatePct()).taxFree(s.getTaxFree()).paidOverride(s.getPaidOverride()).memo(s.getMemo())
                    .kind(s.kindOrDefault()).balanceOverride(s.getBalanceOverride()).region(s.getRegion())
                    .householdHead(Boolean.TRUE.equals(s.getHouseholdHead()))
                    .monthlyBonus(s.getMonthlyBonus()).bonusBalance(s.getBonusBalance())
                    .records(records)
                    .build();
        }
    }

    // 적금 납입으로 적은 지출 한 건
    public record PaymentRecord(Long expenseId, LocalDate date, String settleMonth, Integer amount, String itemName) {}
}
