package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.DailyExpenseRequestDto;
import com.dailo.app.dto.DailyExpenseResponseDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.DailyExpenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/daily-expenses")
@RequiredArgsConstructor
public class DailyExpenseController {

    private final DailyExpenseService dailyExpenseService;

    @PostMapping
    public ResponseEntity<ApiResponse<DailyExpenseResponseDto>> create(@AuthenticationPrincipal CustomUserDetails user, @RequestBody DailyExpenseRequestDto request) {
        DailyExpenseResponseDto response = dailyExpenseService.create(user.getMemberId(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("지출이 등록되었습니다.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DailyExpenseResponseDto>> findById(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id) {
        DailyExpenseResponseDto response = dailyExpenseService.findById(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/budget/{monthlyBudgetId}")
    public ResponseEntity<ApiResponse<List<DailyExpenseResponseDto>>> findByMonthlyBudgetId(
            @AuthenticationPrincipal CustomUserDetails user, @PathVariable Long monthlyBudgetId) {
        List<DailyExpenseResponseDto> response = dailyExpenseService.findByMonthlyBudgetId(user.getMemberId(), monthlyBudgetId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/month/{settleMonth}")
    public ResponseEntity<ApiResponse<List<DailyExpenseResponseDto>>> findBySettleMonth(
            @AuthenticationPrincipal CustomUserDetails user, @PathVariable String settleMonth) {
        List<DailyExpenseResponseDto> response = dailyExpenseService.findBySettleMonth(user.getMemberId(), settleMonth);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DailyExpenseResponseDto>> update(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestBody DailyExpenseRequestDto request) {
        DailyExpenseResponseDto response = dailyExpenseService.update(user.getMemberId(), id, request);
        return ResponseEntity.ok(ApiResponse.ok("지출이 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id) {
        dailyExpenseService.delete(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok("지출이 삭제되었습니다.", null));
    }
}