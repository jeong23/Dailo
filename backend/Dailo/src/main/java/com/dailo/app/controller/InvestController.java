package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.InvestDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.InvestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/invest")
@RequiredArgsConstructor
public class InvestController {

    private final InvestService investService;

    // ─── Setting ───────────────────────────────────────────────
    @GetMapping("/setting")
    public ResponseEntity<ApiResponse<InvestDto.SettingResponse>> getSetting(
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(investService.getSetting(user.getMemberId())));
    }

    @PostMapping("/setting")
    public ResponseEntity<ApiResponse<InvestDto.SettingResponse>> saveSetting(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody InvestDto.SettingRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(investService.saveSetting(user.getMemberId(), req)));
    }

    // ─── Accounts ──────────────────────────────────────────────
    @GetMapping("/accounts")
    public ResponseEntity<ApiResponse<List<InvestDto.AccountResponse>>> getAccounts(
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(investService.getAccounts(user.getMemberId())));
    }

    @PostMapping("/accounts")
    public ResponseEntity<ApiResponse<List<InvestDto.AccountResponse>>> saveAccounts(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody List<InvestDto.AccountRequest> req) {
        return ResponseEntity.ok(ApiResponse.ok(investService.saveAccounts(user.getMemberId(), req)));
    }

    // ─── Dashboard ─────────────────────────────────────────────
    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<InvestDto.DashboardResponse>> getDashboard(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String yearMonth) {
        return ResponseEntity.ok(ApiResponse.ok(investService.getDashboard(user.getMemberId(), yearMonth)));
    }

    // ─── Record ────────────────────────────────────────────────
    @PutMapping("/records/{id}")
    public ResponseEntity<ApiResponse<Void>> updateRecord(
            @PathVariable Long id,
            @RequestBody InvestDto.RecordUpdateRequest req) {
        investService.updateRecord(id, req);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ─── Diary ─────────────────────────────────────────────────
    @GetMapping("/diary")
    public ResponseEntity<ApiResponse<List<InvestDto.DiaryResponse>>> getDiaries(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam int year, @RequestParam int month) {
        return ResponseEntity.ok(ApiResponse.ok(investService.getDiaries(user.getMemberId(), year, month)));
    }

    @PostMapping("/diary")
    public ResponseEntity<ApiResponse<InvestDto.DiaryResponse>> saveDiary(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody InvestDto.DiaryRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(investService.saveDiary(user.getMemberId(), req)));
    }

    @DeleteMapping("/diary/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDiary(@PathVariable Long id) {
        investService.deleteDiary(id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}