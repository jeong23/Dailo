package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.DailyPlanDto;
import com.dailo.app.dto.PlannerBoardDto;
import com.dailo.app.service.DailyPlanService;
import com.dailo.app.service.R2UploadService;
import lombok.RequiredArgsConstructor;
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
    private final R2UploadService r2UploadService;

    @GetMapping("/board")
    public ApiResponse<List<PlannerBoardDto.DayEntry>> findMonthlyBoard(
            @RequestParam int year,
            @RequestParam int month) {
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("month는 1~12 사이여야 합니다: " + month);
        }
        return ApiResponse.ok(dailyPlanService.findMonthlyBoard(year, month));
    }

    @GetMapping("/{date}")
    public ApiResponse<DailyPlanDto.Response> findByDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(dailyPlanService.findByDate(date));
    }

    @PostMapping
    public ApiResponse<DailyPlanDto.Response> upsert(@RequestBody DailyPlanDto.Request request) {
        return ApiResponse.ok(dailyPlanService.upsert(request));
    }

    @PostMapping("/upload-image")
    public ApiResponse<String> uploadImage(@RequestParam("file") MultipartFile file) throws IOException {
        String url = r2UploadService.upload(file);
        return ApiResponse.ok(url);
    }
}
