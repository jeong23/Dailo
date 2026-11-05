package com.dailo.app.dto;

import com.dailo.app.entity.AssetSnapshot;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;

public class AssetSnapshotDto {

    static final long MAX = 1_000_000_000_000_000L; // 1000조 — 오타·오버플로 방지

    // 이번 정산월 값 — 정산월은 서버가 회원 월급일로 정함 (지난 달 기록은 못 바꿈)
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class Request {
        @NotNull @Min(0) @Max(MAX) private Long cash;
        @NotNull @Min(0) @Max(MAX) private Long invest;
        @NotNull @Min(0) @Max(MAX) private Long savings;
        @NotNull @Min(0) @Max(MAX) private Long manual;
    }

    @Getter @Builder
    public static class Response {
        private String settleMonth;
        private long cash;
        private long invest;
        private long savings;
        private long manual;
        private long total;
        private LocalDateTime capturedAt;

        public static Response from(AssetSnapshot s) {
            return Response.builder()
                    .settleMonth(s.getSettleMonth())
                    .cash(s.getCash()).invest(s.getInvest()).savings(s.getSavings()).manual(s.getManual())
                    .total(s.total())
                    .capturedAt(s.getCapturedAt())
                    .build();
        }
    }
}
