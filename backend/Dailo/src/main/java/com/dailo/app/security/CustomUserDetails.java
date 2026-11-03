package com.dailo.app.security;

import com.dailo.app.entity.Member;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

@Getter
public class CustomUserDetails implements UserDetails {

    private final Long memberId;
    private final String username;
    private final String password;
    private final String name;
    private final Integer salaryDay;
    private final boolean admin;   // member.role = ADMIN (DB에서만 지정 — 가입·회원 수정 API로는 못 바꿈)
    // 탈퇴 유예 중 — isEnabled()로 막지 않음: DaoAuthenticationProvider가 비밀번호 확인 전에 걸러서
    // 비밀번호 없이 탈퇴 여부가 드러나고, 로그인 화면에서 복구도 못 함. 대신 필터·로그인에서 직접 확인
    private final java.time.LocalDateTime deletedAt;

    public CustomUserDetails(Member member) {
        this.memberId = member.getId();
        this.username = member.getUsername();
        this.password = member.getPassword();
        this.name = member.getName();
        this.salaryDay = member.getSalaryDay() != null ? member.getSalaryDay() : 25;
        this.admin = "ADMIN".equals(member.getRole());
        this.deletedAt = member.getDeletedAt();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return admin ? List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN"))
                : List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    public boolean isWithdrawn() {
        return deletedAt != null;
    }

    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}