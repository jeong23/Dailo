package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.IncomeRequestDto;
import com.dailo.app.dto.IncomeResponseDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.IncomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/incomes")
@RequiredArgsConstructor
public class IncomeController {

    private final IncomeService incomeService;

    @PostMapping
    public ResponseEntity<ApiResponse<IncomeResponseDto>> create(@AuthenticationPrincipal CustomUserDetails user, @RequestBody IncomeRequestDto request) {
        return ResponseEntity.ok(ApiResponse.ok(incomeService.create(user.getMemberId(), request)));
    }

    @GetMapping("/month/{settleMonth}")
    public ResponseEntity<ApiResponse<List<IncomeResponseDto>>> findByMonth(@AuthenticationPrincipal CustomUserDetails user, @PathVariable String settleMonth) {
        return ResponseEntity.ok(ApiResponse.ok(incomeService.findBySettleMonth(user.getMemberId(), settleMonth)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<IncomeResponseDto>> update(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id, @RequestBody IncomeRequestDto request) {
        return ResponseEntity.ok(ApiResponse.ok(incomeService.update(user.getMemberId(), id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id) {
        incomeService.delete(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
