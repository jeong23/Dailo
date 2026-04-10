package com.budget.dashboard.controller;

import com.budget.dashboard.common.ApiResponse;
import com.budget.dashboard.dto.DailyExpenseRequestDto;
import com.budget.dashboard.dto.DailyExpenseResponseDto;
import com.budget.dashboard.service.DailyExpenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/daily-expenses")
@RequiredArgsConstructor
public class DailyExpenseController {

    private final DailyExpenseService dailyExpenseService;

    @PostMapping
    public ResponseEntity<ApiResponse<DailyExpenseResponseDto>> create(@RequestBody DailyExpenseRequestDto request) {
        DailyExpenseResponseDto response = dailyExpenseService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("지출이 등록되었습니다.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DailyExpenseResponseDto>> findById(@PathVariable Long id) {
        DailyExpenseResponseDto response = dailyExpenseService.findById(id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/budget/{monthlyBudgetId}")
    public ResponseEntity<ApiResponse<List<DailyExpenseResponseDto>>> findByMonthlyBudgetId(
            @PathVariable Long monthlyBudgetId) {
        List<DailyExpenseResponseDto> response = dailyExpenseService.findByMonthlyBudgetId(monthlyBudgetId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/month/{settleMonth}")
    public ResponseEntity<ApiResponse<List<DailyExpenseResponseDto>>> findBySettleMonth(
            @PathVariable String settleMonth) {
        List<DailyExpenseResponseDto> response = dailyExpenseService.findBySettleMonth(settleMonth);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DailyExpenseResponseDto>> update(
            @PathVariable Long id,
            @RequestBody DailyExpenseRequestDto request) {
        DailyExpenseResponseDto response = dailyExpenseService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("지출이 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        dailyExpenseService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("지출이 삭제되었습니다.", null));
    }
}