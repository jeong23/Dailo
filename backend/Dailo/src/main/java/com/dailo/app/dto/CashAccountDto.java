package com.dailo.app.dto;

import com.dailo.app.entity.CashAccount;
import com.dailo.app.service.CashFlow;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;

public class CashAccountDto {

    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class Request {
        @NotBlank(message = "계좌 이름을 입력해주세요")
        @Size(max = 50, message = "계좌 이름은 50자 이내로 입력해주세요")
        private String name;
        @Size(max = 30, message = "은행 이름은 30자 이내로 입력해주세요")
        private String bank;
        @NotNull(message = "잔액을 입력해주세요")
        private Long balance;
        @Size(max = 200, message = "메모는 200자 이내로 입력해주세요")
        private String memo;
    }

    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class ActiveRequest {
        @NotNull
        private Boolean active;
    }

    @Getter @Builder
    public static class Response {
        private Long id;
        private String name;
        private String bank;
        private Long balance;              // 현재 잔액 (기준 잔액 + 그 뒤 기록)
        private Long baseBalance;          // 기준 잔액 — 사용자가 마지막으로 맞춘 값
        private LocalDateTime balanceAsOf; // 기준 시각
        private Long pendingCard;          // 이번 달 카드값 (정산월이 끝나면 빠짐)
        private Boolean active;
        private Integer sortOrder;
        private String memo;

        public static Response from(CashAccount a, CashFlow.AccountBalance calc) {
            return Response.builder().id(a.getId()).name(a.getName()).bank(a.getBank())
                    .balance(calc != null ? calc.current() : a.getBalance())
                    .baseBalance(a.getBalance()).balanceAsOf(a.getBalanceAsOf() != null ? a.getBalanceAsOf() : a.getUpdatedAt())
                    .pendingCard(calc != null ? calc.pendingCard() : 0L)
                    .active(a.isOn()).sortOrder(a.getSortOrder()).memo(a.getMemo())
                    .build();
        }
    }
}
