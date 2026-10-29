package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

// 미래 시각화 보드의 사진 한 장 — 회원별 보드 하나(날짜와 무관하게 매일 같은 보드)
// 위치·크기는 보드 대비 퍼센트(0~100)로 저장 → 폰·폴드·PC 어느 폭에서도 같은 배치 (보드는 4:3 고정 비율)
@Entity
@Table(name = "vision_board_item", indexes = @Index(
        name = "idx_vision_board_item_member", columnList = "member_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class VisionBoardItem extends BaseEntity {

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 500)
    private String imageUrl;

    @Column(nullable = false)
    private Double x;

    @Column(nullable = false)
    private Double y;

    @Column(nullable = false)
    private Double w;

    @Column(nullable = false)
    private Double h;

    @Column(nullable = false)
    private Integer z; // 클수록 위에 그림

    public void moveTo(Double x, Double y, Double w, Double h, Integer z) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.z = z;
    }
}
