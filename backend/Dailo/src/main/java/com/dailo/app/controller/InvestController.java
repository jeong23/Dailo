package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.InvestDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.InvestService;
import com.dailo.app.service.InvestTradeService;
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
    private final InvestTradeService tradeService;

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

    @PutMapping("/setting/tax-inputs")
    public ResponseEntity<ApiResponse<InvestDto.SettingResponse>> saveTaxInputs(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody InvestDto.TaxInputsRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(investService.saveTaxInputs(user.getMemberId(), req)));
    }

    // 매매 비용(수수료·가격 여유)만 저장 — 투자 현황 이번 달 할 일에서 바로 바꿈
    @PutMapping("/setting/trade-costs")
    public ResponseEntity<ApiResponse<Void>> setTradeCosts(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody InvestDto.TradeCostsRequest req) {
        investService.setTradeCosts(user.getMemberId(), req);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // 리밸런싱 모드 켜기/끄기 — 끄면 투자 현황·자산 현황이 기록만 보여줌
    @PutMapping("/setting/rebalance-mode")
    public ResponseEntity<ApiResponse<InvestDto.SettingResponse>> setRebalanceMode(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody InvestDto.RebalanceModeRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(investService.setRebalanceMode(user.getMemberId(), req)));
    }

    // 리밸런싱 방식(테마 안 종목 고르기) + 수익 실현 기준
    @PutMapping("/setting/rebalance-style")
    public ResponseEntity<ApiResponse<Void>> setRebalanceStyle(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody InvestDto.RebalanceStyleRequest req) {
        investService.setRebalanceStyle(user.getMemberId(), req);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // 투자 현황 '납입금 포함' 토글 — 이 달 납입금을 이미 예수금에 넣었는지만 저장
    @PutMapping("/setting/deposited")
    public ResponseEntity<ApiResponse<Void>> setDeposited(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody InvestDto.DepositedRequest req) {
        investService.setDeposited(user.getMemberId(), req);
        return ResponseEntity.ok(ApiResponse.ok(null));
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

    // 계좌 켜기/끄기만 바로 저장 (투자 현황·설정 스위치) — 나머지 설정은 POST /accounts 저장바로
    @PatchMapping("/accounts/{id}/active")
    public ResponseEntity<ApiResponse<Void>> setAccountActive(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestBody InvestDto.ActiveRequest req) {
        investService.setAccountActive(user.getMemberId(), id, req.getActive());
        return ResponseEntity.ok(ApiResponse.ok(null));
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
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestBody InvestDto.RecordUpdateRequest req) {
        investService.updateRecord(user.getMemberId(), id, req);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ─── Trade (체결 완료 → 보유 수량·평균단가 반영) ─────────────
    @PostMapping("/holdings/{holdingId}/trades")
    public ResponseEntity<ApiResponse<InvestDto.TradeResponse>> recordTrade(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long holdingId,
            @RequestBody InvestDto.TradeRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(tradeService.record(user.getMemberId(), holdingId, req)));
    }

    @GetMapping("/trades")
    public ResponseEntity<ApiResponse<List<InvestDto.TradeResponse>>> getTrades(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String yearMonth) {
        return ResponseEntity.ok(ApiResponse.ok(tradeService.list(user.getMemberId(), yearMonth)));
    }

    @DeleteMapping("/trades/{id}")
    public ResponseEntity<ApiResponse<Void>> undoTrade(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        tradeService.undo(user.getMemberId(), id);
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
    public ResponseEntity<ApiResponse<Void>> deleteDiary(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        investService.deleteDiary(user.getMemberId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}