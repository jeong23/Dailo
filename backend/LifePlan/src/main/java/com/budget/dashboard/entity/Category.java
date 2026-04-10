package com.budget.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "category")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Category extends BaseEntity {

    @Column(nullable = false, unique = true, length = 30)
    private String name;

    @Column(length = 10)
    private String icon;

    private Integer sortOrder;

    public void update(String name, String icon, Integer sortOrder) {
        this.name = name;
        this.icon = icon;
        this.sortOrder = sortOrder;
    }
}