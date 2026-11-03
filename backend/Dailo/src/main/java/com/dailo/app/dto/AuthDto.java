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
        private Boolean restore; // 탈퇴 유예 중 계정을 되살리고 로그인
    }

    // 탈퇴 유예 중 로그인 시 409 응답 data — purgeAt 이후엔 데이터가 전부 삭제됨
    @Getter
    @AllArgsConstructor
    public static class WithdrawnResponse {
        private String code;
        private java.time.LocalDateTime purgeAt;
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