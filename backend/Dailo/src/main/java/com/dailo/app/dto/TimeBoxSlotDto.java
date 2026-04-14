package com.dailo.app.dto;

import com.dailo.app.entity.TimeBoxSlot;
import lombok.*;

import java.time.LocalDate;

public class TimeBoxSlotDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private LocalDate planDate;
        private Integer hour;
        private String slot1;
        private String slot2;
        private Boolean slot1Done;
        private Boolean slot2Done;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private LocalDate planDate;
        private Integer hour;
        private String slot1;
        private String slot2;
        private Boolean slot1Done;
        private Boolean slot2Done;

        public static Response from(TimeBoxSlot slot) {
            return Response.builder()
                    .id(slot.getId())
                    .planDate(slot.getPlanDate())
                    .hour(slot.getHour())
                    .slot1(slot.getSlot1())
                    .slot2(slot.getSlot2())
                    .slot1Done(slot.getSlot1Done())
                    .slot2Done(slot.getSlot2Done())
                    .build();
        }
    }
}
