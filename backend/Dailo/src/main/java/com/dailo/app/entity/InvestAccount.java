package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "invest_account")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InvestAccount extends BaseEntity {

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 20)
    private String type; // PENSION, GENERAL, IRP

    @Column(nullable = false)
    private Float targetPct;

    private Integer sortOrder;

    public void update(String name, String type, Float targetPct, Integer sortOrder) {
        this.name = name;
        this.type = type;
        this.targetPct = targetPct;
        this.sortOrder = sortOrder;
    }
}