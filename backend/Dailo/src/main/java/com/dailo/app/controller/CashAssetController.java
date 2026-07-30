package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.CashAssetRequestDto;
import com.dailo.app.dto.CashAssetResponseDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.CashAssetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cash-assets")
@RequiredArgsConstructor
public class CashAssetController {

    private final CashAssetService cashAssetService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CashAssetResponseDto>>> getHistory(
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(cashAssetService.getHistory(user.getMemberId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CashAssetResponseDto>> upsert(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody CashAssetRequestDto req) {
        return ResponseEntity.ok(ApiResponse.ok(cashAssetService.upsert(user.getMemberId(), req)));
    }
}
