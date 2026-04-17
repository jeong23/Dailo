package com.dailo.app.dto;

import com.dailo.app.entity.TimeBoxBlock;
import lombok.*;

import java.time.LocalDate;

public class TimeBoxBlockDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private LocalDate planDate;
        private Integer startHour;
        private Integer startSlot;
        private Integer endHour;
        private Integer endSlot;
        private String content;
        private Boolean isDone;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private LocalDate planDate;
        private Integer startHour;
        private Integer startSlot;
        private Integer endHour;
        private Integer endSlot;
        private String content;
        private Boolean isDone;

        public static Response from(TimeBoxBlock block) {
            return Response.builder()
                    .id(block.getId())
                    .planDate(block.getPlanDate())
                    .startHour(block.getStartHour())
                    .startSlot(block.getStartSlot())
                    .endHour(block.getEndHour())
                    .endSlot(block.getEndSlot())
                    .content(block.getContent())
                    .isDone(block.getIsDone())
                    .build();
        }
    }
}
