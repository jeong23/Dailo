package com.dailo.app.service;

import com.dailo.app.dto.MemberRequestDto;
import com.dailo.app.dto.MemberResponseDto;
import com.dailo.app.entity.Member;
import com.dailo.app.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    private final MemberRepository memberRepository;
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
                .role(request.getRole() != null ? request.getRole() : "USER")
                .salaryGross(request.getSalaryGross())
                .salaryDay(request.getSalaryDay() != null ? request.getSalaryDay() : 25)
                .build();
        return MemberResponseDto.from(memberRepository.save(member));
    }

    public MemberResponseDto findById(Long id) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + id));
        return MemberResponseDto.from(member);
    }

    public MemberResponseDto findByUsername(String username) {
        Member member = memberRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + username));
        return MemberResponseDto.from(member);
    }

    public List<MemberResponseDto> findAll() {
        return memberRepository.findAll().stream()
                .map(MemberResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public MemberResponseDto update(Long id, MemberRequestDto request) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + id));

        String encodedPassword = (request.getPassword() != null && !request.getPassword().isBlank())
                ? passwordEncoder.encode(request.getPassword())
                : member.getPassword();

        member.update(
                request.getUsername() != null ? request.getUsername() : member.getUsername(),
                encodedPassword,
                request.getName() != null ? request.getName() : member.getName(),
                request.getRole() != null ? request.getRole() : member.getRole(),
                request.getSalaryGross() != null ? request.getSalaryGross() : member.getSalaryGross(),
                request.getSalaryDay() != null ? request.getSalaryDay() : member.getSalaryDay()
        );
        return MemberResponseDto.from(member);
    }

    @Transactional
    public void delete(Long id) {
        if (!memberRepository.existsById(id)) {
            throw new IllegalArgumentException("회원을 찾을 수 없습니다: " + id);
        }
        memberRepository.deleteById(id);
    }
}