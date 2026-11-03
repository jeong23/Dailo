package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.MemberRequestDto;
import com.dailo.app.dto.MemberResponseDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    // 회원가입 — SecurityConfig에서 permitAll
    @PostMapping
    public ResponseEntity<ApiResponse<MemberResponseDto>> create(@RequestBody MemberRequestDto request) {
        MemberResponseDto response = memberService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("회원이 생성되었습니다.", response));
    }

    // 본인 프로필만 조회 가능 — path의 id와 인증된 사용자가 다르면 거부 (IDOR 방지)
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MemberResponseDto>> findById(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        MemberResponseDto response = memberService.findById(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    // 본인 프로필만 수정 가능
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MemberResponseDto>> update(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestBody MemberRequestDto request) {
        MemberResponseDto response = memberService.update(user.getMemberId(), id, request);
        return ResponseEntity.ok(ApiResponse.ok("회원 정보가 수정되었습니다.", response));
    }

    // 본인 계정만 탈퇴 가능 — 30일 유예 후 데이터 삭제, data = 삭제 예정 시각
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<LocalDateTime>> delete(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        LocalDateTime purgeAt = memberService.withdraw(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok("탈퇴 처리됐어요. 30일 안에 다시 로그인하면 복구할 수 있어요.", purgeAt));
    }
}
