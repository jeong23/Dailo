package com.dailo.app.service;

import com.dailo.app.dto.MemberRequestDto;
import com.dailo.app.dto.MemberResponseDto;
import com.dailo.app.entity.Member;
import com.dailo.app.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    // 탈퇴 후 복구 가능 기간 — 지나면 MemberPurgeService가 회원 데이터를 전부 삭제
    public static final int WITHDRAW_GRACE_DAYS = 30;

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    // 회원가입 입력 규칙 — 프론트 SignupPage와 같은 기준 (API를 직접 불러도 같은 검증)
    static final java.util.regex.Pattern USERNAME = java.util.regex.Pattern.compile("^[a-z0-9_]{4,20}$");
    static final int PASSWORD_MIN = 8;

    @Transactional
    public MemberResponseDto create(MemberRequestDto request) {
        String username = request.getUsername() == null ? "" : request.getUsername().trim().toLowerCase();
        String name = request.getName() == null ? "" : request.getName().trim();
        String password = request.getPassword() == null ? "" : request.getPassword();
        if (!USERNAME.matcher(username).matches()) {
            throw new IllegalArgumentException("아이디는 영문 소문자·숫자·밑줄(_) 4~20자로 만들어 주세요.");
        }
        if (password.length() < PASSWORD_MIN || password.length() > 64
                || !password.matches(".*[A-Za-z].*") || !password.matches(".*[0-9].*")) {
            throw new IllegalArgumentException("비밀번호는 영문과 숫자를 섞어 8자 이상으로 만들어 주세요.");
        }
        if (name.isEmpty() || name.length() > 30) {
            throw new IllegalArgumentException("이름은 1~30자로 입력해 주세요.");
        }
        if (request.getSalaryDay() != null && (request.getSalaryDay() < 1 || request.getSalaryDay() > 31)) {
            throw new IllegalArgumentException("월급일은 1~31일 중에서 골라 주세요.");
        }
        if (memberRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디예요.");
        }
        Member member = Member.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .name(name)
                .role("USER") // role은 요청으로 못 정함 — 가입 body에 role:ADMIN 넣으면 관리자가 됐었음. 관리자는 DB에서만
                .salaryGross(request.getSalaryGross())
                .salaryDay(request.getSalaryDay() != null ? request.getSalaryDay() : 25)
                .build();
        return MemberResponseDto.from(memberRepository.save(member));
    }

    public MemberResponseDto findById(Long authMemberId, Long id) {
        validateOwnership(authMemberId, id);
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + id));
        return MemberResponseDto.from(member);
    }

    public MemberResponseDto findByUsername(String username) {
        Member member = memberRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + username));
        return MemberResponseDto.from(member);
    }

    @Transactional
    public MemberResponseDto update(Long authMemberId, Long id, MemberRequestDto request) {
        validateOwnership(authMemberId, id);
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + id));

        String encodedPassword = (request.getPassword() != null && !request.getPassword().isBlank())
                ? passwordEncoder.encode(request.getPassword())
                : member.getPassword();

        member.update(
                request.getUsername() != null ? request.getUsername() : member.getUsername(),
                encodedPassword,
                request.getName() != null ? request.getName() : member.getName(),
                member.getRole(), // 본인 수정으로 role 변경 금지 (권한 상승 방지)
                request.getSalaryGross() != null ? request.getSalaryGross() : member.getSalaryGross(),
                request.getSalaryDay() != null ? request.getSalaryDay() : member.getSalaryDay()
        );
        return MemberResponseDto.from(member);
    }

    // 탈퇴 = 바로 지우지 않고 deletedAt만 기록 (로그인·토큰 차단). 유예 기간 안에 로그인하면 복구 가능
    @Transactional
    public LocalDateTime withdraw(Long authMemberId, Long id) {
        validateOwnership(authMemberId, id);
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + id));
        if (!member.isWithdrawn()) member.withdraw();
        return purgeAt(member.getDeletedAt());
    }

    @Transactional
    public void restore(Long memberId) {
        memberRepository.findById(memberId).ifPresent(Member::restore);
    }

    public static LocalDateTime purgeAt(LocalDateTime deletedAt) {
        return deletedAt.plusDays(WITHDRAW_GRACE_DAYS);
    }

    // 본인 리소스만 조회/수정/삭제 가능하도록 검증 (IDOR 방지)
    private void validateOwnership(Long authMemberId, Long id) {
        if (!authMemberId.equals(id)) {
            throw new IllegalArgumentException("회원을 찾을 수 없습니다: " + id);
        }
    }
}