package com.dailo.app.dto;

import com.dailo.app.entity.VisionBoardItem;
import lombok.*;

public class VisionBoardDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private String imageUrl; // 생성 시에만 사용
        private Double x;
        private Double y;
        private Double w;
        private Double h;
        private Integer z;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private String imageUrl;
        private Double x;
        private Double y;
        private Double w;
        private Double h;
        private Integer z;

        public static Response from(VisionBoardItem item) {
            return Response.builder()
                    .id(item.getId())
                    .imageUrl(item.getImageUrl())
                    .x(item.getX())
                    .y(item.getY())
                    .w(item.getW())
                    .h(item.getH())
                    .z(item.getZ())
                    .build();
        }
    }
}
