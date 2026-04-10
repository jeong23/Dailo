package com.budget.dashboard.service;

import com.budget.dashboard.dto.MemberRequestDto;
import com.budget.dashboard.dto.MemberResponseDto;
import com.budget.dashboard.entity.Member;
import com.budget.dashboard.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    private final MemberRepository memberRepository;

    @Transactional
    public MemberResponseDto create(MemberRequestDto request) {
        if (memberRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("이미 존재하는 사용자명입니다: " + request.getUsername());
        }
        Member member = memberRepository.save(request.toEntity());
        return MemberResponseDto.from(member);
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

        member.update(
                request.getUsername(),
                request.getPassword(),
                request.getName(),
                request.getRole(),
                request.getSalaryGross()
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