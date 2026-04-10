package com.budget.dashboard.controller;

import com.budget.dashboard.common.ApiResponse;
import com.budget.dashboard.dto.MonthlyBudgetRequestDto;
import com.budget.dashboard.dto.MonthlyBudgetResponseDto;
import com.budget.dashboard.service.MonthlyBudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/monthly-budgets")
@RequiredArgsConstructor
public class MonthlyBudgetController {

    private final MonthlyBudgetService monthlyBudgetService;

    @PostMapping
    public ResponseEntity<ApiResponse<MonthlyBudgetResponseDto>> create(@RequestBody MonthlyBudgetRequestDto request) {
        MonthlyBudgetResponseDto response = monthlyBudgetService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("월별 예산이 생성되었습니다.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MonthlyBudgetResponseDto>> findById(@PathVariable Long id) {
        MonthlyBudgetResponseDto response = monthlyBudgetService.findById(id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/member/{memberId}")
    public ResponseEntity<ApiResponse<List<MonthlyBudgetResponseDto>>> findByMemberId(@PathVariable Long memberId) {
        List<MonthlyBudgetResponseDto> response = monthlyBudgetService.findByMemberId(memberId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/member/{memberId}/month/{settleMonth}")
    public ResponseEntity<ApiResponse<MonthlyBudgetResponseDto>> findByMemberAndMonth(
            @PathVariable Long memberId,
            @PathVariable String settleMonth) {
        MonthlyBudgetResponseDto response = monthlyBudgetService.findByMemberAndMonth(memberId, settleMonth);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MonthlyBudgetResponseDto>> update(
            @PathVariable Long id,
            @RequestBody MonthlyBudgetRequestDto request) {
        MonthlyBudgetResponseDto response = monthlyBudgetService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("월별 예산이 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        monthlyBudgetService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("월별 예산이 삭제되었습니다.", null));
    }
}