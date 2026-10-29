package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.TimeBoxBlockDto;
import com.dailo.app.service.TimeBoxBlockService;
import com.dailo.app.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/time-box-blocks")
@RequiredArgsConstructor
public class TimeBoxBlockController {

    private final TimeBoxBlockService blockService;

    @GetMapping
    public ApiResponse<List<TimeBoxBlockDto.Response>> getBlocks(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(blockService.findByDate(userDetails.getMemberId(), date));
    }

    @PostMapping
    public ApiResponse<TimeBoxBlockDto.Response> create(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody TimeBoxBlockDto.Request req) {
        return ApiResponse.ok(blockService.create(userDetails.getMemberId(), req));
    }

    @PutMapping("/{id}")
    public ApiResponse<TimeBoxBlockDto.Response> update(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id, @RequestBody TimeBoxBlockDto.Request req) {
        return ApiResponse.ok(blockService.update(userDetails.getMemberId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        blockService.delete(userDetails.getMemberId(), id);
        return ApiResponse.ok(null);
    }
}
