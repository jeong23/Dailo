package com.dailo.app.service;

import com.dailo.app.dto.MemberRequestDto;
import com.dailo.app.dto.MemberResponseDto;
import com.dailo.app.entity.Member;
import com.dailo.app.repository.CashAssetRepository;
import com.dailo.app.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    private final MemberRepository memberRepository;
    private final CashAssetRepository cashAssetRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public MemberResponseDto create(MemberRequestDto request) {
        if (memberRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("이미 존재하는 사용자명입니다: " + request.getUsername());
        }
        Member member = Member.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
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

    @Transactional
    public void delete(Long authMemberId, Long id) {
        validateOwnership(authMemberId, id);
        if (!memberRepository.existsById(id)) {
            throw new IllegalArgumentException("회원을 찾을 수 없습니다: " + id);
        }
        cashAssetRepository.deleteByMemberId(id); // 자식 먼저 (고아 레코드 방지)
        memberRepository.deleteById(id);          // 부모 나중
    }

    // 본인 리소스만 조회/수정/삭제 가능하도록 검증 (IDOR 방지)
    private void validateOwnership(Long authMemberId, Long id) {
        if (!authMemberId.equals(id)) {
            throw new IllegalArgumentException("회원을 찾을 수 없습니다: " + id);
        }
    }
}