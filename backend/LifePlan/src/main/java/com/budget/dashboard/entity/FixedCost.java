package com.budget.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "fixed_cost")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class FixedCost extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false, length = 50)
    private String name;

    private Integer amount;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    private Integer sortOrder;

    public void update(String name, Integer amount, Boolean isActive, Integer sortOrder) {
        this.name = name;
        this.amount = amount;
        this.isActive = isActive;
        this.sortOrder = sortOrder;
    }
}