package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.MonthlyBudgetRequestDto;
import com.dailo.app.dto.MonthlyBudgetResponseDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.MonthlyBudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/monthly-budgets")
@RequiredArgsConstructor
public class MonthlyBudgetController {

    private final MonthlyBudgetService monthlyBudgetService;

    @PostMapping
    public ResponseEntity<ApiResponse<MonthlyBudgetResponseDto>> create(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody MonthlyBudgetRequestDto request) {
        MonthlyBudgetResponseDto response = monthlyBudgetService.create(user.getMemberId(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("월별 예산이 생성되었습니다.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MonthlyBudgetResponseDto>> findById(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        MonthlyBudgetResponseDto response = monthlyBudgetService.findById(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    // 인증된 사용자 자신의 예산 목록만 조회 — path에 memberId를 두지 않는다 (IDOR 방지, CashAssetController 패턴과 동일)
    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<MonthlyBudgetResponseDto>>> findMine(
            @AuthenticationPrincipal CustomUserDetails user) {
        List<MonthlyBudgetResponseDto> response = monthlyBudgetService.findByMemberId(user.getMemberId());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/mine/month/{settleMonth}")
    public ResponseEntity<ApiResponse<MonthlyBudgetResponseDto>> findMineByMonth(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable String settleMonth) {
        MonthlyBudgetResponseDto response = monthlyBudgetService.findByMemberAndMonth(user.getMemberId(), settleMonth);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MonthlyBudgetResponseDto>> update(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody MonthlyBudgetRequestDto request) {
        MonthlyBudgetResponseDto response = monthlyBudgetService.update(user.getMemberId(), id, request);
        return ResponseEntity.ok(ApiResponse.ok("월별 예산이 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        monthlyBudgetService.delete(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok("월별 예산이 삭제되었습니다.", null));
    }
}
