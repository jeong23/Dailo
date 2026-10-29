package com.dailo.app.dto;

import com.dailo.app.entity.CashAccount;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

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
        private Long balance;
        private Boolean active;
        private Integer sortOrder;
        private String memo;

        public static Response from(CashAccount a) {
            return Response.builder().id(a.getId()).name(a.getName()).bank(a.getBank())
                    .balance(a.getBalance()).active(a.isOn()).sortOrder(a.getSortOrder()).memo(a.getMemo())
                    .build();
        }
    }
}
