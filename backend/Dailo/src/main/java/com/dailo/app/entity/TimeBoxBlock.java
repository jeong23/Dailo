package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "time_box_block")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class TimeBoxBlock extends BaseEntity {

    @Column(nullable = false)
    private LocalDate planDate;

    @Column(nullable = false)
    private Integer startHour;

    @Column(nullable = false)
    private Integer startSlot; // 0=정시, 1=30분

    @Column(nullable = false)
    private Integer endHour;

    @Column(nullable = false)
    private Integer endSlot; // 0=정시, 1=30분

    @Column(length = 500)
    private String content;

    @Column(nullable = false)
    private Boolean isDone;

    public void update(String content, Boolean isDone) {
        this.content = content;
        this.isDone = isDone;
    }
}
