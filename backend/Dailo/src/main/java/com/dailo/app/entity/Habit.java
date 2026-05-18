package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "habit")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Habit extends BaseEntity {

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 10)
    private String emoji;

    @Column(length = 20)
    private String color;

    @Column(nullable = false)
    private Boolean isActive;

    private Integer sortOrder;

    @Column(length = 10)
    private String habitType; // "GOOD" or "BAD", null treated as "GOOD"

    public void update(String name, String emoji, String color, String habitType) {
        this.name = name;
        this.emoji = emoji;
        this.color = color;
        this.habitType = habitType;
    }

    public void deactivate() {
        this.isActive = false;
    }
}