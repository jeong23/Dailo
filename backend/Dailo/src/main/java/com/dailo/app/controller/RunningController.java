package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.RunningDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.RunningService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/running")
@RequiredArgsConstructor
public class RunningController {

    private final RunningService runningService;

    // ── Goal ──────────────────────────────

    @PostMapping("/goal")
    public ApiResponse<RunningDto.GoalResponse> saveGoal(@AuthenticationPrincipal CustomUserDetails user, @RequestBody RunningDto.GoalRequest req) {
        return ApiResponse.ok(runningService.saveGoal(user.getMemberId(), req));
    }

    @GetMapping("/goal")
    public ApiResponse<RunningDto.GoalResponse> getGoal(
            @AuthenticationPrincipal CustomUserDetails user, @RequestParam int year, @RequestParam int month) {
        return ApiResponse.ok(runningService.getGoal(user.getMemberId(), year, month));
    }

    // ── Record ────────────────────────────

    @PostMapping("/record")
    public ApiResponse<RunningDto.RecordResponse> saveRecord(@AuthenticationPrincipal CustomUserDetails user, @RequestBody RunningDto.RecordRequest req) {
        return ApiResponse.ok(runningService.saveRecord(user.getMemberId(), req));
    }

    @GetMapping("/record")
    public ApiResponse<RunningDto.RecordResponse> getRecord(
            @AuthenticationPrincipal CustomUserDetails user, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(runningService.getRecord(user.getMemberId(), date));
    }

    @GetMapping("/records")
    public ApiResponse<List<RunningDto.RecordResponse>> getMonthRecords(
            @AuthenticationPrincipal CustomUserDetails user, @RequestParam int year, @RequestParam int month) {
        return ApiResponse.ok(runningService.getMonthRecords(user.getMemberId(), year, month));
    }

    @GetMapping("/records/year")
    public ApiResponse<List<RunningDto.RecordResponse>> getYearRecords(@AuthenticationPrincipal CustomUserDetails user, @RequestParam int year) {
        return ApiResponse.ok(runningService.getYearRecords(user.getMemberId(), year));
    }
}
