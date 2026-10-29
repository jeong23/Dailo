package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.TimeBoxSlotDto;
import com.dailo.app.service.TimeBoxSlotService;
import com.dailo.app.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/time-box")
@RequiredArgsConstructor
public class TimeBoxSlotController {

    private final TimeBoxSlotService timeBoxSlotService;

    @GetMapping
    public ApiResponse<List<TimeBoxSlotDto.Response>> findByDate(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(timeBoxSlotService.findByDate(userDetails.getMemberId(), date));
    }

    @PostMapping
    public ApiResponse<TimeBoxSlotDto.Response> upsert(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody TimeBoxSlotDto.Request request) {
        return ApiResponse.ok(timeBoxSlotService.upsert(userDetails.getMemberId(), request));
    }
}
