package com.budget.dashboard.controller;

import com.budget.dashboard.common.ApiResponse;
import com.budget.dashboard.dto.IncomeRequestDto;
import com.budget.dashboard.dto.IncomeResponseDto;
import com.budget.dashboard.service.IncomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/incomes")
@RequiredArgsConstructor
public class IncomeController {

    private final IncomeService incomeService;

    @PostMapping
    public ResponseEntity<ApiResponse<IncomeResponseDto>> create(@RequestBody IncomeRequestDto request) {
        return ResponseEntity.ok(ApiResponse.ok(incomeService.create(request)));
    }

    @GetMapping("/month/{settleMonth}")
    public ResponseEntity<ApiResponse<List<IncomeResponseDto>>> findByMonth(@PathVariable String settleMonth) {
        return ResponseEntity.ok(ApiResponse.ok(incomeService.findBySettleMonth(settleMonth)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<IncomeResponseDto>> update(@PathVariable Long id, @RequestBody IncomeRequestDto request) {
        return ResponseEntity.ok(ApiResponse.ok(incomeService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        incomeService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
