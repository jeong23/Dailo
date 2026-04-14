package com.dailo.app.dto;

import com.dailo.app.entity.Member;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberRequestDto {

    private String username;
    private String password;
    private String name;
    private String role;
    private Integer salaryGross;

    public Member toEntity() {
        return Member.builder()
                .username(username)
                .password(password)
                .name(name)
                .role(role)
                .salaryGross(salaryGross)
                .build();
    }
}