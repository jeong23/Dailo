package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "time_box_slot", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"plan_date", "hour"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class TimeBoxSlot extends BaseEntity {

    @Column(name = "plan_date", nullable = false)
    private LocalDate planDate;

    // 5 ~ 23
    @Column(nullable = false)
    private Integer hour;

    @Column(length = 100)
    private String slot1;

    @Column(length = 100)
    private String slot2;

    @Column(nullable = false)
    @Builder.Default
    private Boolean slot1Done = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean slot2Done = false;

    public void update(String slot1, String slot2, Boolean slot1Done, Boolean slot2Done) {
        this.slot1 = slot1;
        this.slot2 = slot2;
        this.slot1Done = slot1Done != null ? slot1Done : this.slot1Done;
        this.slot2Done = slot2Done != null ? slot2Done : this.slot2Done;
    }
}
