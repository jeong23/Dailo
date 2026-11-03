package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

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

    @Column(columnDefinition = "INTEGER DEFAULT 25")
    private Integer salaryDay;

    // 탈퇴 시각 — 값이 있으면 로그인·토큰 차단, 30일 유예 뒤 MemberPurgeService가 회원 데이터를 전부 삭제
    @Column
    private LocalDateTime deletedAt;

    public void update(String username, String password, String name, String role, Integer salaryGross, Integer salaryDay) {
        this.username = username;
        this.password = password;
        this.name = name;
        this.role = role;
        this.salaryGross = salaryGross;
        this.salaryDay = salaryDay;
    }

    public void withdraw() {
        this.deletedAt = LocalDateTime.now();
    }

    public void restore() {
        this.deletedAt = null;
    }

    public boolean isWithdrawn() {
        return deletedAt != null;
    }
}
