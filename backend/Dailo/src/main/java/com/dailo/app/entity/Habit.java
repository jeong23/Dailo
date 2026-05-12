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

    public void update(String name, String emoji, String color) {
        this.name = name;
        this.emoji = emoji;
        this.color = color;
    }

    public void deactivate() {
        this.isActive = false;
    }
}