package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.CategoryStatsDto;
import com.dailo.app.dto.DailyStatsDto;
import com.dailo.app.dto.DashboardSummaryDto;
import com.dailo.app.dto.EmergencyHistoryDto;
import com.dailo.app.dto.MonthlyReportDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<DashboardSummaryDto>> getSummary(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam String month) {
        DashboardSummaryDto response = dashboardService.getSummary(user.getMemberId(), month);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/daily-stats")
    public ResponseEntity<ApiResponse<List<DailyStatsDto>>> getDailyStats(@RequestParam String month) {
        List<DailyStatsDto> response = dashboardService.getDailyStats(month);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/category-stats")
    public ResponseEntity<ApiResponse<List<CategoryStatsDto>>> getCategoryStats(@RequestParam String month) {
        List<CategoryStatsDto> response = dashboardService.getCategoryStats(month);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    // memberId는 더 이상 클라이언트 쿼리파라미터로 받지 않는다 — 인증된 사용자 본인 것만 조회 (IDOR 방지)
    @GetMapping("/emergency-history")
    public ResponseEntity<ApiResponse<List<EmergencyHistoryDto>>> getEmergencyHistory(
            @AuthenticationPrincipal CustomUserDetails user) {
        List<EmergencyHistoryDto> response = dashboardService.getEmergencyHistory(user.getMemberId());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/monthly-report")
    public ResponseEntity<ApiResponse<List<MonthlyReportDto>>> getMonthlyReport(
            @AuthenticationPrincipal CustomUserDetails user) {
        List<MonthlyReportDto> response = dashboardService.getMonthlyReport(user.getMemberId());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
