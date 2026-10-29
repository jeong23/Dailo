package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.SavingsDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.SavingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// memberId는 로그인 정보에서만 (IDOR 방지)
@RestController
@RequestMapping("/api/savings")
@RequiredArgsConstructor
public class SavingsController {

    private final SavingsService savingsService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SavingsDto.Response>>> list(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(savingsService.list(user.getMemberId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SavingsDto.Response>> create(
            @AuthenticationPrincipal CustomUserDetails user, @RequestBody SavingsDto.Request req) {
        return ResponseEntity.ok(ApiResponse.ok(savingsService.create(user.getMemberId(), req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<SavingsDto.Response>> update(
            @AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id, @RequestBody SavingsDto.Request req) {
        return ResponseEntity.ok(ApiResponse.ok(savingsService.update(user.getMemberId(), id, req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id) {
        savingsService.delete(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
