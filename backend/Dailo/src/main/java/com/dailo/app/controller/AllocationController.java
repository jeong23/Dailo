package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.InvestDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.AllocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AllocationController {

    private final AllocationService allocationService;

    @GetMapping("/invest/themes")
    public ResponseEntity<ApiResponse<List<InvestDto.ThemeDto>>> getThemes(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(allocationService.getThemes(user.getMemberId())));
    }

    @PostMapping("/invest/themes")
    public ResponseEntity<ApiResponse<List<InvestDto.ThemeDto>>> saveThemes(
            @AuthenticationPrincipal CustomUserDetails user, @RequestBody List<InvestDto.ThemeDto> req) {
        return ResponseEntity.ok(ApiResponse.ok(allocationService.saveThemes(user.getMemberId(), req)));
    }

    @GetMapping("/assets/buckets")
    public ResponseEntity<ApiResponse<List<InvestDto.BucketDto>>> getBuckets(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(allocationService.getBuckets(user.getMemberId())));
    }

    @PostMapping("/assets/buckets")
    public ResponseEntity<ApiResponse<List<InvestDto.BucketDto>>> saveBuckets(
            @AuthenticationPrincipal CustomUserDetails user, @RequestBody List<InvestDto.BucketDto> req) {
        return ResponseEntity.ok(ApiResponse.ok(allocationService.saveBuckets(user.getMemberId(), req)));
    }
}
