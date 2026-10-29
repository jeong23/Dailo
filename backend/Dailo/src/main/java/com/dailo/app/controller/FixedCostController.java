package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.FixedCostRequestDto;
import com.dailo.app.dto.FixedCostResponseDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.FixedCostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// memberId는 항상 로그인 정보에서 — URL/body의 memberId를 믿으면 다른 회원 고정비를 조회·수정할 수 있음 (IDOR)
@RestController
@RequestMapping("/api/fixed-costs")
@RequiredArgsConstructor
public class FixedCostController {

    private final FixedCostService fixedCostService;

    @PostMapping
    public ResponseEntity<ApiResponse<FixedCostResponseDto>> create(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody FixedCostRequestDto request) {
        FixedCostResponseDto response = fixedCostService.create(userDetails.getMemberId(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("고정비가 생성되었습니다.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FixedCostResponseDto>> findById(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        FixedCostResponseDto response = fixedCostService.findById(userDetails.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<FixedCostResponseDto>>> findMine(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        List<FixedCostResponseDto> response = fixedCostService.findByMemberId(userDetails.getMemberId());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/mine/active")
    public ResponseEntity<ApiResponse<List<FixedCostResponseDto>>> findMineActive(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        List<FixedCostResponseDto> response = fixedCostService.findActiveByMemberId(userDetails.getMemberId());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<FixedCostResponseDto>> update(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @RequestBody FixedCostRequestDto request) {
        FixedCostResponseDto response = fixedCostService.update(userDetails.getMemberId(), id, request);
        return ResponseEntity.ok(ApiResponse.ok("고정비가 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        fixedCostService.delete(userDetails.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok("고정비가 삭제되었습니다.", null));
    }
}
