package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "member")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Member extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(nullable = false, length = 30)
    private String name;

    @Column(nullable = false, length = 20)
    private String role;

    @Column
    private Integer salaryGross;

    public void update(String username, String password, String name, String role, Integer salaryGross) {
        this.username = username;
        this.password = password;
        this.name = name;
        this.role = role;
        this.salaryGross = salaryGross;
    }
}