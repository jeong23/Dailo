package com.dailo.app.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

public class AuthDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginRequest {
        private String username;
        private String password;
    }

    @Getter
    @AllArgsConstructor
    public static class LoginResponse {
        private String token;
        private Long memberId;
        private String name;
        private Integer salaryDay;
    }
}