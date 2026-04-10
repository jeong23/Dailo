package com.budget.dashboard.controller;

import com.budget.dashboard.common.ApiResponse;
import com.budget.dashboard.dto.CategoryStatsDto;
import com.budget.dashboard.dto.DailyStatsDto;
import com.budget.dashboard.dto.DashboardSummaryDto;
import com.budget.dashboard.dto.EmergencyHistoryDto;
import com.budget.dashboard.dto.MonthlyReportDto;
import com.budget.dashboard.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<DashboardSummaryDto>> getSummary(@RequestParam String month) {
        DashboardSummaryDto response = dashboardService.getSummary(month);
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

    @GetMapping("/emergency-history")
    public ResponseEntity<ApiResponse<List<EmergencyHistoryDto>>> getEmergencyHistory(@RequestParam Long memberId) {
        List<EmergencyHistoryDto> response = dashboardService.getEmergencyHistory(memberId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/monthly-report")
    public ResponseEntity<ApiResponse<List<MonthlyReportDto>>> getMonthlyReport(@RequestParam Long memberId) {
        List<MonthlyReportDto> response = dashboardService.getMonthlyReport(memberId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
