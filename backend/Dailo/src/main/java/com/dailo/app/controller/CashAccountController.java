package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.CashAccountDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.CashAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// 현금 계좌 — 변경 API는 ?settleMonth= 필수 (그 달 현금 자산 잔액을 계좌 합계로 맞춤)
@RestController
@RequestMapping("/api/cash-accounts")
@RequiredArgsConstructor
public class CashAccountController {

    private final CashAccountService cashAccountService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CashAccountDto.Response>>> list(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(required = false) String settleMonth) {
        return ResponseEntity.ok(ApiResponse.ok(cashAccountService.list(user.getMemberId(), settleMonth)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CashAccountDto.Response>> create(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String settleMonth,
            @Valid @RequestBody CashAccountDto.Request req) {
        return ResponseEntity.ok(ApiResponse.ok(cashAccountService.create(user.getMemberId(), req, settleMonth)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CashAccountDto.Response>> update(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestParam String settleMonth,
            @Valid @RequestBody CashAccountDto.Request req) {
        return ResponseEntity.ok(ApiResponse.ok(cashAccountService.update(user.getMemberId(), id, req, settleMonth)));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<ApiResponse<Void>> setActive(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestParam String settleMonth,
            @Valid @RequestBody CashAccountDto.ActiveRequest req) {
        cashAccountService.setActive(user.getMemberId(), id, req.getActive(), settleMonth);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestParam String settleMonth) {
        cashAccountService.delete(user.getMemberId(), id, settleMonth);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
