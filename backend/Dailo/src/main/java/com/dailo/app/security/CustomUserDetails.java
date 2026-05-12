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

    public CustomUserDetails(Member member) {
        this.memberId = member.getId();
        this.username = member.getUsername();
        this.password = member.getPassword();
        this.name = member.getName();
        this.salaryDay = member.getSalaryDay() != null ? member.getSalaryDay() : 25;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}