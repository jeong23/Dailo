package com.dailo.app.dto;

import com.dailo.app.entity.Habit;
import com.dailo.app.entity.HabitLog;
import lombok.*;

import java.time.LocalDate;

public class HabitDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private Long memberId;
        private String name;
        private String emoji;
        private String color;
        private Integer sortOrder;
        private String habitType; // "GOOD" or "BAD"
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private String name;
        private String emoji;
        private String color;
        private Integer sortOrder;
        private String habitType;

        public static Response from(Habit habit) {
            return Response.builder()
                    .id(habit.getId())
                    .name(habit.getName())
                    .emoji(habit.getEmoji())
                    .color(habit.getColor())
                    .sortOrder(habit.getSortOrder())
                    .habitType(habit.getHabitType() != null ? habit.getHabitType() : "GOOD")
                    .build();
        }
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LogRequest {
        private Long habitId;
        private LocalDate logDate;
    }

    @Getter
    @Builder
    public static class LogResponse {
        private Long id;
        private Long habitId;
        private LocalDate logDate;
        private int count;

        public static LogResponse from(HabitLog log) {
            return LogResponse.builder()
                    .id(log.getId())
                    .habitId(log.getHabit().getId())
                    .logDate(log.getLogDate())
                    .count(log.getCount() > 0 ? log.getCount() : 1)
                    .build();
        }
    }
}