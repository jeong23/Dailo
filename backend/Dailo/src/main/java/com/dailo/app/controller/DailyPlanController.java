package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.DailyPlanDto;
import com.dailo.app.dto.PlannerBoardDto;
import com.dailo.app.service.DailyPlanService;
import com.dailo.app.service.ImageStorageService;
import com.dailo.app.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/daily-plans")
@RequiredArgsConstructor
public class DailyPlanController {

    private final DailyPlanService dailyPlanService;
    private final ImageStorageService imageStorageService;

    @GetMapping("/board")
    public ApiResponse<List<PlannerBoardDto.DayEntry>> findMonthlyBoard(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam int year,
            @RequestParam int month) {
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("month는 1~12 사이여야 합니다: " + month);
        }
        return ApiResponse.ok(dailyPlanService.findMonthlyBoard(userDetails.getMemberId(), year, month));
    }

    @GetMapping("/{date}")
    public ApiResponse<DailyPlanDto.Response> findByDate(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(dailyPlanService.findByDate(userDetails.getMemberId(), date));
    }

    @PostMapping
    public ApiResponse<DailyPlanDto.Response> upsert(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody DailyPlanDto.Request request) {
        return ApiResponse.ok(dailyPlanService.upsert(userDetails.getMemberId(), request));
    }

    @PostMapping("/upload-image")
    public ApiResponse<String> uploadImage(@RequestParam("file") MultipartFile file) throws IOException {
        String url = imageStorageService.store("future-vision", file);
        return ApiResponse.ok(url);
    }
}
