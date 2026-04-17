package com.dailo.app.dto;

import com.dailo.app.entity.TodoItem;
import lombok.*;

import java.time.LocalDate;

public class TodoItemDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private LocalDate planDate;
        private String content;
        private String type;
        private Integer sortOrder;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateRequest {
        private String content;
        private Boolean isDone;
        private String type;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private LocalDate planDate;
        private String content;
        private String type;
        private Boolean isDone;
        private Integer sortOrder;

        public static Response from(TodoItem item) {
            return Response.builder()
                    .id(item.getId())
                    .planDate(item.getPlanDate())
                    .content(item.getContent())
                    .type(item.getType())
                    .isDone(item.getIsDone())
                    .sortOrder(item.getSortOrder())
                    .build();
        }
    }
}
