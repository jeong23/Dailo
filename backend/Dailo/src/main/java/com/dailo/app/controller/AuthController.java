package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.AuthDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.security.JwtUtil;
import com.dailo.app.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final MemberService memberService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<?>> login(@RequestBody AuthDto.LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        // 탈퇴 유예 중: 비밀번호가 맞을 때만 알려줌. restore=true면 되살리고 로그인
        if (userDetails.isWithdrawn()) {
            if (!Boolean.TRUE.equals(request.getRestore())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiResponse<>(false, "탈퇴 처리된 계정이에요.",
                        new AuthDto.WithdrawnResponse("WITHDRAWN", MemberService.purgeAt(userDetails.getDeletedAt()))));
            }
            memberService.restore(userDetails.getMemberId());
        }
        String token = jwtUtil.generateToken(userDetails.getMemberId(), userDetails.getUsername());

        return ResponseEntity.ok(ApiResponse.ok(
                new AuthDto.LoginResponse(token, userDetails.getMemberId(), userDetails.getName(), userDetails.getSalaryDay())
        ));
    }

    // 사용 중 토큰 연장 — 유효한 토큰으로만 새 토큰 발급 (/api/auth/**는 permitAll이라 principal 직접 확인)
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthDto.LoginResponse>> refresh(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("로그인이 만료되었습니다."));
        }
        String token = jwtUtil.generateToken(userDetails.getMemberId(), userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok(
                new AuthDto.LoginResponse(token, userDetails.getMemberId(), userDetails.getName(), userDetails.getSalaryDay())
        ));
    }
}
