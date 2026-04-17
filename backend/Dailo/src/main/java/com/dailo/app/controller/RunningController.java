package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.RunningDto;
import com.dailo.app.service.RunningService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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
    public ApiResponse<RunningDto.GoalResponse> saveGoal(@RequestBody RunningDto.GoalRequest req) {
        return ApiResponse.ok(runningService.saveGoal(req));
    }

    @GetMapping("/goal")
    public ApiResponse<RunningDto.GoalResponse> getGoal(
            @RequestParam int year, @RequestParam int month) {
        return ApiResponse.ok(runningService.getGoal(year, month));
    }

    // ── Record ────────────────────────────

    @PostMapping("/record")
    public ApiResponse<RunningDto.RecordResponse> saveRecord(@RequestBody RunningDto.RecordRequest req) {
        return ApiResponse.ok(runningService.saveRecord(req));
    }

    @GetMapping("/record")
    public ApiResponse<RunningDto.RecordResponse> getRecord(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(runningService.getRecord(date));
    }

    @GetMapping("/records")
    public ApiResponse<List<RunningDto.RecordResponse>> getMonthRecords(
            @RequestParam int year, @RequestParam int month) {
        return ApiResponse.ok(runningService.getMonthRecords(year, month));
    }

    @GetMapping("/records/year")
    public ApiResponse<List<RunningDto.RecordResponse>> getYearRecords(@RequestParam int year) {
        return ApiResponse.ok(runningService.getYearRecords(year));
    }
}
